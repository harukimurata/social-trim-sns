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

let commentTableName: string | undefined;
let notificationTableName: string | undefined;

async function resolveTableNames(): Promise<void> {
  if (commentTableName && notificationTableName) return;
  const [commentRes, notifRes] = await Promise.all([
    ssm.send(new GetParameterCommand({ Name: process.env.COMMENT_TABLE_SSM_PATH })),
    ssm.send(new GetParameterCommand({ Name: process.env.NOTIFICATION_TABLE_SSM_PATH })),
  ]);
  commentTableName = commentRes.Parameter!.Value!;
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
      const commentId = image?.commentId?.S;
      const type = image?.type?.S;

      const isFavorite = type === "FAVORITE";
      const isViral = type === "VIRAL";
      if (!senderId || !commentId || (!isFavorite && !isViral)) return;

      const countField = isFavorite ? "favoriteCount" : "viralCount";
      const delta = isInsert ? 1 : -1;

      // Comment.favoriteCount / viralCount をアトミックに更新する
      try {
        await dynamo.send(
          new UpdateCommand({
            TableName: commentTableName!,
            Key: { id: commentId },
            UpdateExpression: `ADD ${countField} :delta`,
            ExpressionAttributeValues: {
              ":delta": delta,
              ...(isRemove ? { ":zero": 0 } : {}),
            },
            ...(isRemove
              ? {
                  ConditionExpression:
                    `attribute_not_exists(${countField}) OR ${countField} > :zero`,
                }
              : {}),
          })
        );
      } catch (err: any) {
        if (err.name === "ConditionalCheckFailedException") {
          console.warn(`${countField} already 0, skip decrement`, { senderId, commentId });
          return;
        }
        throw err;
      }

      if (!isInsert) return;

      // コメントオーナーと postId を取得する
      const commentRes = await dynamo.send(
        new GetCommand({
          TableName: commentTableName!,
          Key: { id: commentId },
          ProjectionExpression: "userId, postId",
        })
      );
      const recipientId = commentRes.Item?.userId;
      const postId = commentRes.Item?.postId;
      if (!recipientId || !postId || recipientId === senderId) return;

      const now = new Date().toISOString();
      await dynamo.send(
        new PutCommand({
          TableName: notificationTableName!,
          Item: {
            id: randomUUID(),
            recipientId,
            senderId,
            type: isFavorite ? "COMMENT_FAVORITE" : "COMMENT_VIRAL",
            postId,
            commentId,
            isRead: false,
            createdAt: now,
            updatedAt: now,
          },
        })
      );
    })
  );
};
