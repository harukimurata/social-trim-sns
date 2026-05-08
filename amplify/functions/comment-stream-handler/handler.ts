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
let commentTableName: string | undefined;
let notificationTableName: string | undefined;

async function resolveTableNames(): Promise<void> {
  if (postTableName && commentTableName && notificationTableName) return;
  const [postRes, commentRes, notifRes] = await Promise.all([
    ssm.send(new GetParameterCommand({ Name: process.env.POST_TABLE_SSM_PATH })),
    ssm.send(new GetParameterCommand({ Name: process.env.COMMENT_TABLE_SSM_PATH })),
    ssm.send(new GetParameterCommand({ Name: process.env.NOTIFICATION_TABLE_SSM_PATH })),
  ]);
  postTableName = postRes.Parameter!.Value!;
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
      const commentId = image?.id?.S;
      const postId = image?.postId?.S;
      const parentCommentId = image?.parentCommentId?.S;
      const senderId = image?.userId?.S;

      if (!commentId || !postId || !senderId) return;

      const delta = isInsert ? 1 : -1;

      // Post.commentCount をアトミックに更新する
      try {
        await dynamo.send(
          new UpdateCommand({
            TableName: postTableName!,
            Key: { id: postId },
            UpdateExpression: "ADD commentCount :delta",
            ExpressionAttributeValues: {
              ":delta": delta,
              ...(isRemove ? { ":zero": 0 } : {}),
            },
            ...(isRemove
              ? {
                  ConditionExpression:
                    "attribute_not_exists(commentCount) OR commentCount > :zero",
                }
              : {}),
          })
        );
      } catch (err: any) {
        if (err.name === "ConditionalCheckFailedException") {
          console.warn("commentCount already 0, skip decrement", { postId, commentId });
          return;
        }
        throw err;
      }

      if (!isInsert) return;

      let recipientId: string | undefined;
      let notificationType: string;
      let targetCommentId: string | undefined;

      if (!parentCommentId) {
        // トップレベルコメント: 投稿オーナーに通知する
        const postRes = await dynamo.send(
          new GetCommand({
            TableName: postTableName!,
            Key: { id: postId },
            ProjectionExpression: "userId",
          })
        );
        recipientId = postRes.Item?.userId;
        notificationType = "COMMENT";
      } else {
        // 返信コメント: 親コメントオーナーに通知する
        const parentRes = await dynamo.send(
          new GetCommand({
            TableName: commentTableName!,
            Key: { id: parentCommentId },
            ProjectionExpression: "userId",
          })
        );
        recipientId = parentRes.Item?.userId;
        notificationType = "COMMENT_REPLY";
        targetCommentId = parentCommentId;
      }

      if (!recipientId || recipientId === senderId) return;

      const now = new Date().toISOString();
      await dynamo.send(
        new PutCommand({
          TableName: notificationTableName!,
          Item: {
            id: randomUUID(),
            recipientId,
            senderId,
            type: notificationType,
            postId,
            commentId: targetCommentId ?? null,
            isRead: false,
            createdAt: now,
            updatedAt: now,
          },
        })
      );
    })
  );
};
