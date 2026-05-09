import type { ScheduledHandler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  QueryCommand,
  BatchWriteCommand,
  DeleteCommand,
  type ScanCommandInput,
  type QueryCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { S3Client, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});
const ssm = new SSMClient({});

let postTableName: string | undefined;
let commentTableName: string | undefined;
let userReactionTableName: string | undefined;
let commentReactionTableName: string | undefined;
let notificationTableName: string | undefined;
let storageBucketName: string | undefined;

async function resolveResources(): Promise<void> {
  if (
    postTableName &&
    commentTableName &&
    userReactionTableName &&
    commentReactionTableName &&
    notificationTableName &&
    storageBucketName
  )
    return;
  const [postRes, commentRes, userReactionRes, commentReactionRes, notifRes, bucketRes] =
    await Promise.all([
      ssm.send(new GetParameterCommand({ Name: process.env.POST_TABLE_SSM_PATH })),
      ssm.send(new GetParameterCommand({ Name: process.env.COMMENT_TABLE_SSM_PATH })),
      ssm.send(new GetParameterCommand({ Name: process.env.USER_REACTION_TABLE_SSM_PATH })),
      ssm.send(
        new GetParameterCommand({ Name: process.env.COMMENT_REACTION_TABLE_SSM_PATH })
      ),
      ssm.send(
        new GetParameterCommand({ Name: process.env.NOTIFICATION_TABLE_SSM_PATH })
      ),
      ssm.send(
        new GetParameterCommand({ Name: process.env.STORAGE_BUCKET_SSM_PATH })
      ),
    ]);
  postTableName = postRes.Parameter!.Value!;
  commentTableName = commentRes.Parameter!.Value!;
  userReactionTableName = userReactionRes.Parameter!.Value!;
  commentReactionTableName = commentReactionRes.Parameter!.Value!;
  notificationTableName = notifRes.Parameter!.Value!;
  storageBucketName = bucketRes.Parameter!.Value!;
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

// DynamoDB BatchWriteItem は 25 件ずつ
async function batchDelete(
  tableName: string,
  keys: Record<string, any>[]
): Promise<void> {
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

// S3 DeleteObjects は 1000 件ずつ
async function deleteS3Objects(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  for (let i = 0; i < keys.length; i += 1000) {
    const chunk = keys.slice(i, i + 1000);
    await s3.send(
      new DeleteObjectsCommand({
        Bucket: storageBucketName!,
        Delete: { Objects: chunk.map((Key) => ({ Key })) },
      })
    );
  }
}

export const handler: ScheduledHandler = async () => {
  await resolveResources();

  const nowSec = Math.floor(Date.now() / 1000);

  // ttl が期限切れかつ保護されていない投稿を全件取得
  // ttl はDynamoDB予約語のため ExpressionAttributeNames でエスケープする
  const expiredPosts = await scanAll({
    TableName: postTableName!,
    FilterExpression:
      "isProtected = :false AND attribute_exists(#ttl) AND #ttl <= :now",
    ExpressionAttributeNames: { "#ttl": "ttl" },
    ExpressionAttributeValues: { ":false": false, ":now": nowSec },
    ProjectionExpression: "id, imageUrls",
  });

  if (expiredPosts.length === 0) return;

  console.log(`Deleting ${expiredPosts.length} expired post(s)`);

  await Promise.all(
    expiredPosts.map(async ({ id: postId, imageUrls: postImageUrls }) => {
      // postId に紐づくコメントを GSI で取得（imageUrls も含めて取得）
      const comments = await queryAll({
        TableName: commentTableName!,
        IndexName: "commentsByPostIdAndPostedAt",
        KeyConditionExpression: "postId = :postId",
        ExpressionAttributeValues: { ":postId": postId },
        ProjectionExpression: "id, imageUrls",
      });

      // 各コメントに紐づくコメントリアクションを削除
      // CommentReaction は (userId PK, commentId SK) でインデックスなし → スキャン
      await Promise.all(
        comments.map(async ({ id: commentId }) => {
          const reactions = await scanAll({
            TableName: commentReactionTableName!,
            FilterExpression: "commentId = :commentId",
            ExpressionAttributeValues: { ":commentId": commentId },
            ProjectionExpression: "userId, commentId",
          });
          if (reactions.length > 0) {
            await batchDelete(
              commentReactionTableName!,
              reactions.map(({ userId, commentId: cid }) => ({ userId, commentId: cid }))
            );
          }
        })
      );

      // コメント画像を S3 から削除
      const commentImageKeys = comments.flatMap(
        ({ imageUrls }) => (imageUrls as string[] | null | undefined) ?? []
      );
      await deleteS3Objects(commentImageKeys);

      // コメントを削除
      if (comments.length > 0) {
        await batchDelete(commentTableName!, comments.map(({ id }) => ({ id })));
      }

      // 投稿へのユーザーリアクションを削除
      // UserReaction は (userId PK, postId SK) でpostId単独インデックスなし → スキャン
      const userReactions = await scanAll({
        TableName: userReactionTableName!,
        FilterExpression: "postId = :postId",
        ExpressionAttributeValues: { ":postId": postId },
        ProjectionExpression: "userId, postId",
      });
      if (userReactions.length > 0) {
        await batchDelete(
          userReactionTableName!,
          userReactions.map(({ userId, postId: pid }) => ({ userId, postId: pid }))
        );
      }

      // 通知を削除
      // Notification は id PK, postId は属性のみ → スキャン
      const notifications = await scanAll({
        TableName: notificationTableName!,
        FilterExpression: "postId = :postId",
        ExpressionAttributeValues: { ":postId": postId },
        ProjectionExpression: "id",
      });
      if (notifications.length > 0) {
        await batchDelete(
          notificationTableName!,
          notifications.map(({ id }) => ({ id }))
        );
      }

      // 投稿画像を S3 から削除
      const postImageKeys = (postImageUrls as string[] | null | undefined) ?? [];
      await deleteS3Objects(postImageKeys);

      // 投稿本体を削除
      await dynamo.send(
        new DeleteCommand({ TableName: postTableName!, Key: { id: postId } })
      );
    })
  );

  console.log(`Deleted ${expiredPosts.length} expired post(s) with all related data`);
};
