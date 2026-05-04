import type { PostConfirmationTriggerHandler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  UpdateCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const ssm = new SSMClient({});

let counterTableName: string | undefined;
let userTableName: string | undefined;

async function resolveTableNames(): Promise<void> {
  if (counterTableName && userTableName) return;
  const [counterRes, userRes] = await Promise.all([
    ssm.send(
      new GetParameterCommand({ Name: process.env.COUNTER_TABLE_SSM_PATH })
    ),
    ssm.send(
      new GetParameterCommand({ Name: process.env.USER_TABLE_SSM_PATH })
    ),
  ]);
  counterTableName = counterRes.Parameter!.Value!;
  userTableName = userRes.Parameter!.Value!;
}

export const handler: PostConfirmationTriggerHandler = async (event) => {
  // event.userName はCognito内部UUID。サインアップ時のsubをuserIdとして使う
  const userId = event.request.userAttributes.sub;
  const now = new Date().toISOString();

  await resolveTableNames();

  // 1. CounterTable の USER_SEQ を ADD 1 してアトミックに sequentialUserId を取得
  const counterResult = await dynamo.send(
    new UpdateCommand({
      TableName: counterTableName,
      Key: { counterName: "USER_SEQ" },
      UpdateExpression: "ADD currentValue :inc",
      ExpressionAttributeValues: { ":inc": 1 },
      ReturnValues: "UPDATED_NEW",
    })
  );

  const sequentialUserId = counterResult.Attributes!.currentValue as number;

  // 2. UsersTable にレコードを書き込む
  await dynamo.send(
    new PutCommand({
      TableName: userTableName,
      Item: {
        userId,
        sequentialUserId,
        username: "",
        bio: "",
        avatarUrl: "",
        followingCount: 0,
        followerCount: 0,
        createdAt: now,
        updatedAt: now,
      },
    })
  );

  return event;
};
