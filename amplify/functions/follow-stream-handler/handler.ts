import type { DynamoDBStreamHandler } from "aws-lambda";
import { DynamoDBClient, TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const ssm = new SSMClient({});

let userTableName: string | undefined;

async function resolveTableName(): Promise<void> {
  if (userTableName) return;
  const res = await ssm.send(
    new GetParameterCommand({ Name: process.env.USER_TABLE_SSM_PATH })
  );
  userTableName = res.Parameter!.Value!;
}

export const handler: DynamoDBStreamHandler = async (event) => {
  await resolveTableName();

  await Promise.all(
    event.Records.map(async (record) => {
      const isInsert = record.eventName === "INSERT";
      const isRemove = record.eventName === "REMOVE";
      if (!isInsert && !isRemove) return;

      // INSERT は NewImage、REMOVE は OldImage からキーを取得する
      const image = isInsert ? record.dynamodb?.NewImage : record.dynamodb?.OldImage;
      const followeeId = image?.followeeId?.S;
      const followerId = image?.followerId?.S;
      if (!followeeId || !followerId) return;

      const delta = isInsert ? 1 : -1;

      // REMOVE 時は両カウントが 0 を下回らないよう ConditionExpression でガードする。
      // ConditionalCheckFailed（すでに 0）はリトライループを防ぐためスキップする。
      try {
        await dynamo.send(
          new TransactWriteCommand({
            TransactItems: [
              {
                Update: {
                  TableName: userTableName!,
                  Key: { userId: followeeId },
                  UpdateExpression: "ADD followerCount :delta",
                  ExpressionAttributeValues: { ":delta": delta, ...(isRemove ? { ":zero": 0 } : {}) },
                  ...(isRemove ? { ConditionExpression: "attribute_not_exists(followerCount) OR followerCount > :zero" } : {}),
                },
              },
              {
                Update: {
                  TableName: userTableName!,
                  Key: { userId: followerId },
                  UpdateExpression: "ADD followingCount :delta",
                  ExpressionAttributeValues: { ":delta": delta, ...(isRemove ? { ":zero": 0 } : {}) },
                  ...(isRemove ? { ConditionExpression: "attribute_not_exists(followingCount) OR followingCount > :zero" } : {}),
                },
              },
            ],
          })
        );
      } catch (err) {
        if (
          err instanceof TransactionCanceledException &&
          err.CancellationReasons?.every(
            (r) => !r.Code || r.Code === "None" || r.Code === "ConditionalCheckFailed"
          )
        ) {
          // カウントがすでに 0 の場合は更新をスキップする
          console.warn("count already 0, skip decrement", { followeeId, followerId });
          return;
        }
        throw err;
      }
    })
  );
};
