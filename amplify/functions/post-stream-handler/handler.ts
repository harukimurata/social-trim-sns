import type { DynamoDBStreamHandler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
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

  const inserts = event.Records.filter((r) => r.eventName === "INSERT");

  await Promise.all(
    inserts.map(async (record) => {
      const userId = record.dynamodb?.NewImage?.userId?.S;
      if (!userId) return;

      await dynamo.send(
        new UpdateCommand({
          TableName: userTableName,
          Key: { userId },
          UpdateExpression: "ADD totalPostCount :inc",
          ExpressionAttributeValues: { ":inc": 1 },
        })
      );
    })
  );
};
