import type { DynamoDBStreamHandler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  UpdateCommand,
  GetCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import { randomUUID } from "crypto";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const ssm = new SSMClient({});

let postTableName: string | undefined;
let notificationTableName: string | undefined;

async function resolveTableNames(): Promise<void> {
  if (postTableName && notificationTableName) return;
  const [postRes, notifRes] = await Promise.all([
    ssm.send(new GetParameterCommand({ Name: process.env.POST_TABLE_SSM_PATH })),
    ssm.send(new GetParameterCommand({ Name: process.env.NOTIFICATION_TABLE_SSM_PATH })),
  ]);
  postTableName = postRes.Parameter!.Value!;
  notificationTableName = notifRes.Parameter!.Value!;
}

export const handler: DynamoDBStreamHandler = async (event) => {
  await resolveTableNames();

  await Promise.all(
    event.Records.map(async (record) => {
      const isInsert = record.eventName === "INSERT";
      const isRemove = record.eventName === "REMOVE";
      if (!isInsert && !isRemove) return;

      const image = isInsert ? record.dynamodb?.NewImage : record.dynamodb?.OldImage;
      const senderId = image?.userId?.S;
      const postId = image?.postId?.S;
      const type = image?.type?.S;

      // FAVORITE タイプのみ処理する
      if (!senderId || !postId || type !== "FAVORITE") return;

      const delta = isInsert ? 1 : -1;

      // Post.favoriteCount をアトミックに更新する
      // REMOVE 時は 0 を下回らないよう ConditionExpression でガードする
      try {
        await dynamo.send(
          new UpdateCommand({
            TableName: postTableName!,
            Key: { id: postId },
            UpdateExpression: "ADD favoriteCount :delta",
            ExpressionAttributeValues: {
              ":delta": delta,
              ...(isRemove ? { ":zero": 0 } : {}),
            },
            ...(isRemove
              ? {
                  ConditionExpression:
                    "attribute_not_exists(favoriteCount) OR favoriteCount > :zero",
                }
              : {}),
          })
        );
      } catch (err: any) {
        if (err.name === "ConditionalCheckFailedException") {
          console.warn("favoriteCount already 0, skip decrement", { senderId, postId });
          return;
        }
        throw err;
      }

      // INSERT 時のみ通知を作成する
      if (!isInsert) return;

      // 投稿オーナーを取得する（自分の投稿への自分のお気に入りは通知しない）
      const postRes = await dynamo.send(
        new GetCommand({
          TableName: postTableName!,
          Key: { id: postId },
          ProjectionExpression: "userId",
        })
      );
      const recipientId = postRes.Item?.userId;
      if (!recipientId || recipientId === senderId) return;

      const now = new Date().toISOString();
      await dynamo.send(
        new PutCommand({
          TableName: notificationTableName!,
          Item: {
            id: randomUUID(),
            recipientId,
            senderId,
            type: "FAVORITE",
            postId,
            isRead: false,
            createdAt: now,
            updatedAt: now,
          },
        })
      );
    })
  );
};
