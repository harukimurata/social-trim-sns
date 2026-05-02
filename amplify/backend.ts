import { defineBackend } from "@aws-amplify/backend";
import { auth } from "./auth/resource.js";
import { data } from "./data/resource.js";
import { postConfirmation } from "./auth/post-confirmation/resource.js";
import { storage } from "./storage/resource.js";
import { Stack } from "aws-cdk-lib";
import { Function as LambdaFunction } from "aws-cdk-lib/aws-lambda";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";

const backend = defineBackend({
  auth,
  data,
  postConfirmation,
  storage,
});

const { tables } = backend.data.resources;

// SSM パラメータはデータスタックのスコープ内に作成する。
// こうすることで auth スタックが data スタックを CloudFormation 参照せず、
// auth ↔ data の循環依存を回避できる。Lambda はランタイムで SSM を読む。
const dataStack = Stack.of(tables["Counter"]);

const COUNTER_TABLE_SSM = "/social-trim-sns/counter-table-name";
const USER_TABLE_SSM = "/social-trim-sns/user-table-name";

new StringParameter(dataStack, "CounterTableNameSsm", {
  parameterName: COUNTER_TABLE_SSM,
  stringValue: tables["Counter"].tableName,
});

new StringParameter(dataStack, "UserTableNameSsm", {
  parameterName: USER_TABLE_SSM,
  stringValue: tables["User"].tableName,
});

const lambda = backend.postConfirmation.resources.lambda as LambdaFunction;

// ワイルドカード ARN を使うことで auth スタックから data スタックへの
// CloudFormation クロススタック参照を作らない
lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["dynamodb:UpdateItem", "dynamodb:PutItem"],
    resources: [
      "arn:aws:dynamodb:*:*:table/Counter-*",
      "arn:aws:dynamodb:*:*:table/User-*",
    ],
  })
);

lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["ssm:GetParameter"],
    resources: ["arn:aws:ssm:*:*:parameter/social-trim-sns/*"],
  })
);

// SSM パスは静的な文字列として渡す（CloudFormation クロススタック参照なし）
lambda.addEnvironment("COUNTER_TABLE_SSM_PATH", COUNTER_TABLE_SSM);
lambda.addEnvironment("USER_TABLE_SSM_PATH", USER_TABLE_SSM);
