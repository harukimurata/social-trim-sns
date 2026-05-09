import type { ScheduledHandler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  QueryCommand,
  BatchWriteCommand,
  type ScanCommandInput,
  type QueryCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const ssm = new SSMClient({});

let postTableName: string | undefined;
let viralRankingTableName: string | undefined;

async function resolveResources(): Promise<void> {
  if (postTableName && viralRankingTableName) return;
  const [postRes, viralRankingRes] = await Promise.all([
    ssm.send(new GetParameterCommand({ Name: process.env.POST_TABLE_SSM_PATH })),
    ssm.send(new GetParameterCommand({ Name: process.env.VIRAL_RANKING_TABLE_SSM_PATH })),
  ]);
  postTableName = postRes.Parameter!.Value!;
  viralRankingTableName = viralRankingRes.Parameter!.Value!;
}

async function scanAll(params: ScanCommandInput): Promise<Record<string, any>[]> {
  const items: Record<string, any>[] = [];
  let lastKey: Record<string, any> | undefined;
  do {
    const res = await dynamo.send(
      new ScanCommand({ ...params, ExclusiveStartKey: lastKey })
    );
    items.push(...(res.Items ?? []));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  return items;
}

async function queryAll(params: QueryCommandInput): Promise<Record<string, any>[]> {
  const items: Record<string, any>[] = [];
  let lastKey: Record<string, any> | undefined;
  do {
    const res = await dynamo.send(
      new QueryCommand({ ...params, ExclusiveStartKey: lastKey })
    );
    items.push(...(res.Items ?? []));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  return items;
}

async function batchDelete(tableName: string, keys: Record<string, any>[]): Promise<void> {
  for (let i = 0; i < keys.length; i += 25) {
    const chunk = keys.slice(i, i + 25);
    await dynamo.send(
      new BatchWriteCommand({
        RequestItems: {
          [tableName]: chunk.map((key) => ({ DeleteRequest: { Key: key } })),
        },
      })
    );
  }
}

async function batchPut(tableName: string, items: Record<string, any>[]): Promise<void> {
  for (let i = 0; i < items.length; i += 25) {
    const chunk = items.slice(i, i + 25);
    await dynamo.send(
      new BatchWriteCommand({
        RequestItems: {
          [tableName]: chunk.map((item) => ({ PutRequest: { Item: item } })),
        },
      })
    );
  }
}

export const handler: ScheduledHandler = async () => {
  await resolveResources();

  // 24時間以内に更新された投稿を全件スキャン
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const recentPosts = await scanAll({
    TableName: postTableName!,
    FilterExpression: "updatedAt >= :cutoff",
    ExpressionAttributeValues: { ":cutoff": cutoff },
    ProjectionExpression: "id, commentCount, favoriteCount, viralCount",
  });

  // スコア算出 → 降順ソート → 上位100件
  const top100 = recentPosts
    .map((post) => ({
      postId: post.id as string,
      score:
        (post.commentCount ?? 0) * 3 +
        (post.favoriteCount ?? 0) * 1 +
        (post.viralCount ?? 0) * 2,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 100);

  // 既存ランキングを削除（rank は予約語のため ExpressionAttributeNames でエスケープ）
  const existing = await queryAll({
    TableName: viralRankingTableName!,
    KeyConditionExpression: "rankingType = :type",
    ExpressionAttributeValues: { ":type": "VIRAL" },
    ProjectionExpression: "rankingType, #r",
    ExpressionAttributeNames: { "#r": "rank" },
  });
  if (existing.length > 0) {
    await batchDelete(
      viralRankingTableName!,
      existing.map(({ rankingType, rank }) => ({ rankingType, rank }))
    );
  }

  // 新しいランキングを書き込み
  if (top100.length > 0) {
    await batchPut(
      viralRankingTableName!,
      top100.map((item, i) => ({
        rankingType: "VIRAL",
        rank: i + 1,
        postId: item.postId,
        score: item.score,
      }))
    );
  }

  console.log(`ViralRanking updated: ${top100.length} posts`);
};
