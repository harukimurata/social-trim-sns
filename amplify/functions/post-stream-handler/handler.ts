import type { DynamoDBStreamHandler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const ssm = new SSMClient({});

// 10分ウィンドウ: 同一ユーザーが同じハッシュタグに連投してもウィンドウ内では1カウントのみ
const WINDOW_SECONDS = 600;
// HashtagUserActivity TTL: ウィンドウ終了 + 3日（集計対象2日 + バッファ1日）
const ACTIVITY_TTL_BUFFER = 3 * 86400;

let userTableName: string | undefined;
let hashtagDailyCountTableName: string | undefined;
let hashtagUserActivityTableName: string | undefined;

async function resolveTableNames(): Promise<void> {
  if (userTableName && hashtagDailyCountTableName && hashtagUserActivityTableName) return;
  const [userRes, dailyCountRes, activityRes] = await Promise.all([
    ssm.send(new GetParameterCommand({ Name: process.env.USER_TABLE_SSM_PATH })),
    ssm.send(new GetParameterCommand({ Name: process.env.HASHTAG_DAILY_COUNT_TABLE_SSM_PATH })),
    ssm.send(new GetParameterCommand({ Name: process.env.HASHTAG_USER_ACTIVITY_TABLE_SSM_PATH })),
  ]);
  userTableName = userRes.Parameter!.Value!;
  hashtagDailyCountTableName = dailyCountRes.Parameter!.Value!;
  hashtagUserActivityTableName = activityRes.Parameter!.Value!;
}

function toWindowKey(isoTimestamp: string): number {
  return Math.floor(new Date(isoTimestamp).getTime() / 1000 / WINDOW_SECONDS);
}

// "2025-01-09T12:34:56.000Z" → "20250109"
function toDateKey(isoTimestamp: string): string {
  return isoTimestamp.slice(0, 10).replace(/-/g, "");
}

// dateKey の3日後 00:00:00 UTC を Unix 秒で返す
function toDailyCountTtl(dateKey: string): number {
  const year = parseInt(dateKey.slice(0, 4), 10);
  const month = parseInt(dateKey.slice(4, 6), 10) - 1;
  const day = parseInt(dateKey.slice(6, 8), 10);
  const date = new Date(Date.UTC(year, month, day + 3));
  return Math.floor(date.getTime() / 1000);
}

async function incrementHashtagCounts(
  userId: string,
  hashtags: string[],
  createdAt: string
): Promise<void> {
  const wk = toWindowKey(createdAt);
  const dateKey = toDateKey(createdAt);
  const activityTtl = (wk + 1) * WINDOW_SECONDS + ACTIVITY_TTL_BUFFER;
  const dailyTtl = toDailyCountTtl(dateKey);

  await Promise.all(
    hashtags.map(async (hashtag) => {
      const pk = `${hashtag}#${userId}#${wk}`;

      // postCount を ADD 1。TTL は初回のみ if_not_exists で設定。
      const activityRes = await dynamo.send(
        new UpdateCommand({
          TableName: hashtagUserActivityTableName,
          Key: { pk },
          UpdateExpression: "ADD postCount :inc SET #ttl = if_not_exists(#ttl, :ttlVal)",
          ExpressionAttributeNames: { "#ttl": "ttl" },
          ExpressionAttributeValues: { ":inc": 1, ":ttlVal": activityTtl },
          ReturnValues: "UPDATED_NEW",
        })
      );

      // このウィンドウで初投稿 → 当日の HashtagDailyCount をインクリメント
      if (activityRes.Attributes?.postCount === 1) {
        await dynamo.send(
          new UpdateCommand({
            TableName: hashtagDailyCountTableName,
            Key: { hashtag, dateKey },
            UpdateExpression:
              "ADD #count :inc SET #ttl = if_not_exists(#ttl, :ttlVal)",
            ExpressionAttributeNames: { "#count": "count", "#ttl": "ttl" },
            ExpressionAttributeValues: { ":inc": 1, ":ttlVal": dailyTtl },
          })
        );
      }
    })
  );
}

async function decrementHashtagCounts(
  userId: string,
  hashtags: string[],
  createdAt: string
): Promise<void> {
  const wk = toWindowKey(createdAt);
  const dateKey = toDateKey(createdAt);

  await Promise.all(
    hashtags.map(async (hashtag) => {
      const pk = `${hashtag}#${userId}#${wk}`;

      try {
        // postCount > 0 のときのみデクリメント
        const activityRes = await dynamo.send(
          new UpdateCommand({
            TableName: hashtagUserActivityTableName,
            Key: { pk },
            UpdateExpression: "ADD postCount :dec",
            ConditionExpression: "postCount > :zero",
            ExpressionAttributeValues: { ":dec": -1, ":zero": 0 },
            ReturnValues: "UPDATED_NEW",
          })
        );

        // ウィンドウ内の投稿がすべて消えた → 当日の HashtagDailyCount をデクリメント（0未満ガード）
        if (activityRes.Attributes?.postCount === 0) {
          await dynamo.send(
            new UpdateCommand({
              TableName: hashtagDailyCountTableName,
              Key: { hashtag, dateKey },
              UpdateExpression: "ADD #count :dec",
              ConditionExpression: "#count > :zero",
              ExpressionAttributeNames: { "#count": "count" },
              ExpressionAttributeValues: { ":dec": -1, ":zero": 0 },
            })
          );
        }
      } catch (err: any) {
        // ConditionalCheckFailedException: item なし or postCount が既に 0 → スキップ
        if (err.name !== "ConditionalCheckFailedException") throw err;
      }
    })
  );
}

export const handler: DynamoDBStreamHandler = async (event) => {
  await resolveTableNames();

  for (const record of event.Records) {
    if (record.eventName === "INSERT") {
      const img = record.dynamodb?.NewImage;
      if (!img) continue;

      const userId = img.userId?.S;
      const createdAt = img.createdAt?.S;
      const hashtags = (img.hashtags?.L?.map((h) => h.S).filter(Boolean) ?? []) as string[];

      if (userId) {
        await dynamo.send(
          new UpdateCommand({
            TableName: userTableName,
            Key: { userId },
            UpdateExpression: "ADD totalPostCount :inc",
            ExpressionAttributeValues: { ":inc": 1 },
          })
        );
      }

      if (userId && createdAt && hashtags.length > 0) {
        await incrementHashtagCounts(userId, hashtags, createdAt);
      }
    } else if (record.eventName === "REMOVE") {
      const img = record.dynamodb?.OldImage;
      if (!img) continue;

      const userId = img.userId?.S;
      const createdAt = img.createdAt?.S;
      const hashtags = (img.hashtags?.L?.map((h) => h.S).filter(Boolean) ?? []) as string[];

      if (userId && createdAt && hashtags.length > 0) {
        await decrementHashtagCounts(userId, hashtags, createdAt);
      }
    }
  }
};
