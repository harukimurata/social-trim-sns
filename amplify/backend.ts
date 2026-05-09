import { defineBackend } from "@aws-amplify/backend";
import { auth } from "./auth/resource.js";
import { data } from "./data/resource.js";
import { postConfirmation } from "./auth/post-confirmation/resource.js";
import { postStreamHandler } from "./functions/post-stream-handler/resource.js";
import { followStreamHandler } from "./functions/follow-stream-handler/resource.js";
import { userReactionStreamHandler } from "./functions/user-reaction-stream-handler/resource.js";
import { commentStreamHandler } from "./functions/comment-stream-handler/resource.js";
import { commentReactionStreamHandler } from "./functions/comment-reaction-stream-handler/resource.js";
import { deleteExpiredPosts } from "./functions/delete-expired-posts/resource.js";
import { viralRankingBatch } from "./functions/viral-ranking-batch/resource.js";
import { storage } from "./storage/resource.js";
import { Stack, CfnResource, Duration } from "aws-cdk-lib";
import { Function as LambdaFunction, CfnEventSourceMapping } from "aws-cdk-lib/aws-lambda";
import { StreamViewType } from "aws-cdk-lib/aws-dynamodb";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Rule, Schedule } from "aws-cdk-lib/aws-events";
import { LambdaFunction as LambdaTarget } from "aws-cdk-lib/aws-events-targets";

const backend = defineBackend({
  auth,
  data,
  postConfirmation,
  postStreamHandler,
  followStreamHandler,
  userReactionStreamHandler,
  commentStreamHandler,
  commentReactionStreamHandler,
  deleteExpiredPosts,
  viralRankingBatch,
  storage,
});

const { tables } = backend.data.resources;

// SSM パラメータはデータスタックのスコープ内に作成する。
// こうすることで auth スタックが data スタックを CloudFormation 参照せず、
// auth ↔ data の循環依存を回避できる。Lambda はランタイムで SSM を読む。
const dataStack = Stack.of(tables["Counter"]);

const COUNTER_TABLE_SSM = "/social-trim-sns/counter-table-name";
const USER_TABLE_SSM = "/social-trim-sns/user-table-name";
const POST_TABLE_SSM = "/social-trim-sns/post-table-name";
const COMMENT_TABLE_SSM = "/social-trim-sns/comment-table-name";
const NOTIFICATION_TABLE_SSM = "/social-trim-sns/notification-table-name";
const USER_REACTION_TABLE_SSM = "/social-trim-sns/user-reaction-table-name";
const COMMENT_REACTION_TABLE_SSM = "/social-trim-sns/comment-reaction-table-name";
const HASHTAG_DAILY_COUNT_TABLE_SSM = "/social-trim-sns/hashtag-daily-count-table-name";
const HASHTAG_USER_ACTIVITY_TABLE_SSM = "/social-trim-sns/hashtag-user-activity-table-name";
const STORAGE_BUCKET_SSM = "/social-trim-sns/storage-bucket-name";
const VIRAL_RANKING_TABLE_SSM = "/social-trim-sns/viral-ranking-table-name";

new StringParameter(dataStack, "CounterTableNameSsm", {
  parameterName: COUNTER_TABLE_SSM,
  stringValue: tables["Counter"].tableName,
});

new StringParameter(dataStack, "UserTableNameSsm", {
  parameterName: USER_TABLE_SSM,
  stringValue: tables["User"].tableName,
});

new StringParameter(dataStack, "PostTableNameSsm", {
  parameterName: POST_TABLE_SSM,
  stringValue: tables["Post"].tableName,
});

new StringParameter(dataStack, "CommentTableNameSsm", {
  parameterName: COMMENT_TABLE_SSM,
  stringValue: tables["Comment"].tableName,
});

new StringParameter(dataStack, "NotificationTableNameSsm", {
  parameterName: NOTIFICATION_TABLE_SSM,
  stringValue: tables["Notification"].tableName,
});

new StringParameter(dataStack, "UserReactionTableNameSsm", {
  parameterName: USER_REACTION_TABLE_SSM,
  stringValue: tables["UserReaction"].tableName,
});

new StringParameter(dataStack, "CommentReactionTableNameSsm", {
  parameterName: COMMENT_REACTION_TABLE_SSM,
  stringValue: tables["CommentReaction"].tableName,
});

new StringParameter(dataStack, "HashtagDailyCountTableNameSsm", {
  parameterName: HASHTAG_DAILY_COUNT_TABLE_SSM,
  stringValue: tables["HashtagDailyCount"].tableName,
});

new StringParameter(dataStack, "HashtagUserActivityTableNameSsm", {
  parameterName: HASHTAG_USER_ACTIVITY_TABLE_SSM,
  stringValue: tables["HashtagUserActivity"].tableName,
});

new StringParameter(dataStack, "StorageBucketNameSsm", {
  parameterName: STORAGE_BUCKET_SSM,
  stringValue: backend.storage.resources.bucket.bucketName,
});

new StringParameter(dataStack, "ViralRankingTableNameSsm", {
  parameterName: VIRAL_RANKING_TABLE_SSM,
  stringValue: tables["ViralRanking"].tableName,
});

// ── post-confirmation Lambda ──────────────────────────────────────────────
const confirmationLambda = backend.postConfirmation.resources.lambda as LambdaFunction;

// ワイルドカード ARN を使うことで auth スタックから data スタックへの
// CloudFormation クロススタック参照を作らない
confirmationLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["dynamodb:UpdateItem", "dynamodb:PutItem"],
    resources: [
      "arn:aws:dynamodb:*:*:table/Counter-*",
      "arn:aws:dynamodb:*:*:table/User-*",
    ],
  })
);

confirmationLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["ssm:GetParameter"],
    resources: ["arn:aws:ssm:*:*:parameter/social-trim-sns/*"],
  })
);

// SSM パスは静的な文字列として渡す（CloudFormation クロススタック参照なし）
confirmationLambda.addEnvironment("COUNTER_TABLE_SSM_PATH", COUNTER_TABLE_SSM);
confirmationLambda.addEnvironment("USER_TABLE_SSM_PATH", USER_TABLE_SSM);

// ── post-stream-handler Lambda ────────────────────────────────────────────
const streamLambda = backend.postStreamHandler.resources.lambda as LambdaFunction;

// Amplify Gen 2 のテーブルは Custom::AmplifyDynamoDBTable カスタムリソース。
// amplifyDynamoDbTables が公式エスケープハッチ（tables["Post"].node.defaultChild は undefined）。
const { amplifyDynamoDbTables } = backend.data.resources.cfnResources;

// HashtagDailyCount / HashtagUserActivity の TTL を有効化
const hashtagDailyCountCfnResource = (amplifyDynamoDbTables["HashtagDailyCount"] as any).resource as CfnResource;
hashtagDailyCountCfnResource.addPropertyOverride("TimeToLiveSpecification", {
  AttributeName: "ttl",
  Enabled: true,
});

const hashtagUserActivityCfnResource = (amplifyDynamoDbTables["HashtagUserActivity"] as any).resource as CfnResource;
hashtagUserActivityCfnResource.addPropertyOverride("TimeToLiveSpecification", {
  AttributeName: "ttl",
  Enabled: true,
});

const postTableWrapper = amplifyDynamoDbTables["Post"];
// NEW_AND_OLD_IMAGES に変更することでカスタムリソースの再実行を強制し、
// Disabled になったストリームを新しい Enabled ストリームに置き換える。
// INSERT イベントでは OldImage が null のため Lambda ハンドラーへの影響はない。
postTableWrapper.streamSpecification = { streamViewType: StreamViewType.NEW_AND_OLD_IMAGES };

// カスタムリソース Lambda が TableStreamArn を返すため getAtt で参照する
const postCfnResource = (postTableWrapper as any).resource as CfnResource;

// CfnEventSourceMapping をテーブルと同じスタック (dataStack) に置く。
// Lambda スタックに置くと、データスタックの TableStreamArn エクスポートが
// 古い Disabled ストリームを指したままで CfnEventSourceMapping が作成される
// タイミング問題が発生するため、同一スタック内で依存関係を解決する。
new CfnEventSourceMapping(Stack.of(postCfnResource), "PostStreamToLambda", {
  functionName: streamLambda.functionArn,
  eventSourceArn: postCfnResource.getAtt("TableStreamArn").toString(),
  startingPosition: "LATEST",
  filterCriteria: {
    filters: [{ pattern: JSON.stringify({ eventName: ["INSERT", "REMOVE"] }) }],
  },
});

// ストリーム読み取り権限（ワイルドカード ARN でクロススタック CFn 参照を避ける）
streamLambda.addToRolePolicy(
  new PolicyStatement({
    actions: [
      "dynamodb:GetRecords",
      "dynamodb:GetShardIterator",
      "dynamodb:DescribeStream",
      "dynamodb:ListStreams",
    ],
    resources: ["arn:aws:dynamodb:*:*:table/Post-*/stream/*"],
  })
);

streamLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["dynamodb:UpdateItem"],
    resources: [
      "arn:aws:dynamodb:*:*:table/User-*",
      "arn:aws:dynamodb:*:*:table/HashtagDailyCount-*",
      "arn:aws:dynamodb:*:*:table/HashtagUserActivity-*",
    ],
  })
);

streamLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["ssm:GetParameter"],
    resources: ["arn:aws:ssm:*:*:parameter/social-trim-sns/*"],
  })
);

streamLambda.addEnvironment("USER_TABLE_SSM_PATH", USER_TABLE_SSM);
streamLambda.addEnvironment("HASHTAG_DAILY_COUNT_TABLE_SSM_PATH", HASHTAG_DAILY_COUNT_TABLE_SSM);
streamLambda.addEnvironment("HASHTAG_USER_ACTIVITY_TABLE_SSM_PATH", HASHTAG_USER_ACTIVITY_TABLE_SSM);

// ── follow-stream-handler Lambda ──────────────────────────────────────────
const followStreamLambda = backend.followStreamHandler.resources.lambda as LambdaFunction;

const followTableWrapper = amplifyDynamoDbTables["Follow"];
followTableWrapper.streamSpecification = { streamViewType: StreamViewType.NEW_AND_OLD_IMAGES };
const followCfnResource = (followTableWrapper as any).resource as CfnResource;

new CfnEventSourceMapping(Stack.of(followCfnResource), "FollowStreamToLambda", {
  functionName: followStreamLambda.functionArn,
  eventSourceArn: followCfnResource.getAtt("TableStreamArn").toString(),
  startingPosition: "LATEST",
  filterCriteria: {
    filters: [{ pattern: JSON.stringify({ eventName: ["INSERT", "REMOVE"] }) }],
  },
});

followStreamLambda.addToRolePolicy(
  new PolicyStatement({
    actions: [
      "dynamodb:GetRecords",
      "dynamodb:GetShardIterator",
      "dynamodb:DescribeStream",
      "dynamodb:ListStreams",
    ],
    resources: ["arn:aws:dynamodb:*:*:table/Follow-*/stream/*"],
  })
);

followStreamLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["dynamodb:UpdateItem"],
    resources: ["arn:aws:dynamodb:*:*:table/User-*"],
  })
);

followStreamLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["ssm:GetParameter"],
    resources: ["arn:aws:ssm:*:*:parameter/social-trim-sns/*"],
  })
);

followStreamLambda.addEnvironment("USER_TABLE_SSM_PATH", USER_TABLE_SSM);

// ── user-reaction-stream-handler Lambda ───────────────────────────────────
const userReactionStreamLambda = backend.userReactionStreamHandler.resources.lambda as LambdaFunction;

const userReactionTableWrapper = amplifyDynamoDbTables["UserReaction"];
userReactionTableWrapper.streamSpecification = { streamViewType: StreamViewType.NEW_AND_OLD_IMAGES };
const userReactionCfnResource = (userReactionTableWrapper as any).resource as CfnResource;

new CfnEventSourceMapping(Stack.of(userReactionCfnResource), "UserReactionStreamToLambda", {
  functionName: userReactionStreamLambda.functionArn,
  eventSourceArn: userReactionCfnResource.getAtt("TableStreamArn").toString(),
  startingPosition: "LATEST",
  filterCriteria: {
    filters: [{ pattern: JSON.stringify({ eventName: ["INSERT", "REMOVE"] }) }],
  },
});

userReactionStreamLambda.addToRolePolicy(
  new PolicyStatement({
    actions: [
      "dynamodb:GetRecords",
      "dynamodb:GetShardIterator",
      "dynamodb:DescribeStream",
      "dynamodb:ListStreams",
    ],
    resources: ["arn:aws:dynamodb:*:*:table/UserReaction-*/stream/*"],
  })
);

userReactionStreamLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["dynamodb:GetItem", "dynamodb:UpdateItem"],
    resources: ["arn:aws:dynamodb:*:*:table/Post-*"],
  })
);

userReactionStreamLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["dynamodb:PutItem"],
    resources: ["arn:aws:dynamodb:*:*:table/Notification-*"],
  })
);

userReactionStreamLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["ssm:GetParameter"],
    resources: ["arn:aws:ssm:*:*:parameter/social-trim-sns/*"],
  })
);

userReactionStreamLambda.addEnvironment("POST_TABLE_SSM_PATH", POST_TABLE_SSM);
userReactionStreamLambda.addEnvironment("NOTIFICATION_TABLE_SSM_PATH", NOTIFICATION_TABLE_SSM);

// ── comment-stream-handler Lambda ─────────────────────────────────────────
const commentStreamLambda = backend.commentStreamHandler.resources.lambda as LambdaFunction;

const commentTableWrapper = amplifyDynamoDbTables["Comment"];
commentTableWrapper.streamSpecification = { streamViewType: StreamViewType.NEW_AND_OLD_IMAGES };
const commentCfnResource = (commentTableWrapper as any).resource as CfnResource;

new CfnEventSourceMapping(Stack.of(commentCfnResource), "CommentStreamToLambda", {
  functionName: commentStreamLambda.functionArn,
  eventSourceArn: commentCfnResource.getAtt("TableStreamArn").toString(),
  startingPosition: "LATEST",
  filterCriteria: {
    filters: [{ pattern: JSON.stringify({ eventName: ["INSERT", "REMOVE"] }) }],
  },
});

commentStreamLambda.addToRolePolicy(
  new PolicyStatement({
    actions: [
      "dynamodb:GetRecords",
      "dynamodb:GetShardIterator",
      "dynamodb:DescribeStream",
      "dynamodb:ListStreams",
    ],
    resources: ["arn:aws:dynamodb:*:*:table/Comment-*/stream/*"],
  })
);

commentStreamLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["dynamodb:GetItem", "dynamodb:UpdateItem"],
    resources: ["arn:aws:dynamodb:*:*:table/Post-*"],
  })
);

commentStreamLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["dynamodb:GetItem"],
    resources: ["arn:aws:dynamodb:*:*:table/Comment-*"],
  })
);

commentStreamLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["dynamodb:PutItem"],
    resources: ["arn:aws:dynamodb:*:*:table/Notification-*"],
  })
);

commentStreamLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["ssm:GetParameter"],
    resources: ["arn:aws:ssm:*:*:parameter/social-trim-sns/*"],
  })
);

commentStreamLambda.addEnvironment("POST_TABLE_SSM_PATH", POST_TABLE_SSM);
commentStreamLambda.addEnvironment("COMMENT_TABLE_SSM_PATH", COMMENT_TABLE_SSM);
commentStreamLambda.addEnvironment("NOTIFICATION_TABLE_SSM_PATH", NOTIFICATION_TABLE_SSM);

// ── comment-reaction-stream-handler Lambda ────────────────────────────────
const commentReactionStreamLambda = backend.commentReactionStreamHandler.resources.lambda as LambdaFunction;

const commentReactionTableWrapper = amplifyDynamoDbTables["CommentReaction"];
commentReactionTableWrapper.streamSpecification = { streamViewType: StreamViewType.NEW_AND_OLD_IMAGES };
const commentReactionCfnResource = (commentReactionTableWrapper as any).resource as CfnResource;

new CfnEventSourceMapping(Stack.of(commentReactionCfnResource), "CommentReactionStreamToLambda", {
  functionName: commentReactionStreamLambda.functionArn,
  eventSourceArn: commentReactionCfnResource.getAtt("TableStreamArn").toString(),
  startingPosition: "LATEST",
  filterCriteria: {
    filters: [{ pattern: JSON.stringify({ eventName: ["INSERT", "REMOVE"] }) }],
  },
});

commentReactionStreamLambda.addToRolePolicy(
  new PolicyStatement({
    actions: [
      "dynamodb:GetRecords",
      "dynamodb:GetShardIterator",
      "dynamodb:DescribeStream",
      "dynamodb:ListStreams",
    ],
    resources: ["arn:aws:dynamodb:*:*:table/CommentReaction-*/stream/*"],
  })
);

commentReactionStreamLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["dynamodb:GetItem", "dynamodb:UpdateItem"],
    resources: ["arn:aws:dynamodb:*:*:table/Comment-*"],
  })
);

commentReactionStreamLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["dynamodb:PutItem"],
    resources: ["arn:aws:dynamodb:*:*:table/Notification-*"],
  })
);

commentReactionStreamLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["ssm:GetParameter"],
    resources: ["arn:aws:ssm:*:*:parameter/social-trim-sns/*"],
  })
);

commentReactionStreamLambda.addEnvironment("COMMENT_TABLE_SSM_PATH", COMMENT_TABLE_SSM);
commentReactionStreamLambda.addEnvironment("NOTIFICATION_TABLE_SSM_PATH", NOTIFICATION_TABLE_SSM);

// ── delete-expired-posts Lambda（6時間ごとのスケジュール実行） ────────────
const deleteExpiredPostsLambda = backend.deleteExpiredPosts.resources.lambda as LambdaFunction;

new Rule(Stack.of(deleteExpiredPostsLambda), "DeleteExpiredPostsSchedule", {
  schedule: Schedule.rate(Duration.hours(6)),
  targets: [new LambdaTarget(deleteExpiredPostsLambda)],
});

deleteExpiredPostsLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["dynamodb:Scan"],
    resources: [
      "arn:aws:dynamodb:*:*:table/Post-*",
      "arn:aws:dynamodb:*:*:table/UserReaction-*",
      "arn:aws:dynamodb:*:*:table/CommentReaction-*",
      "arn:aws:dynamodb:*:*:table/Notification-*",
    ],
  })
);

deleteExpiredPostsLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["dynamodb:Query"],
    resources: ["arn:aws:dynamodb:*:*:table/Comment-*/index/*"],
  })
);

deleteExpiredPostsLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["dynamodb:BatchWriteItem", "dynamodb:DeleteItem"],
    resources: [
      "arn:aws:dynamodb:*:*:table/Post-*",
      "arn:aws:dynamodb:*:*:table/Comment-*",
      "arn:aws:dynamodb:*:*:table/UserReaction-*",
      "arn:aws:dynamodb:*:*:table/CommentReaction-*",
      "arn:aws:dynamodb:*:*:table/Notification-*",
    ],
  })
);

deleteExpiredPostsLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["ssm:GetParameter"],
    resources: ["arn:aws:ssm:*:*:parameter/social-trim-sns/*"],
  })
);

deleteExpiredPostsLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["s3:DeleteObject"],
    resources: [`${backend.storage.resources.bucket.bucketArn}/*`],
  })
);

deleteExpiredPostsLambda.addEnvironment("POST_TABLE_SSM_PATH", POST_TABLE_SSM);
deleteExpiredPostsLambda.addEnvironment("COMMENT_TABLE_SSM_PATH", COMMENT_TABLE_SSM);
deleteExpiredPostsLambda.addEnvironment("USER_REACTION_TABLE_SSM_PATH", USER_REACTION_TABLE_SSM);
deleteExpiredPostsLambda.addEnvironment("COMMENT_REACTION_TABLE_SSM_PATH", COMMENT_REACTION_TABLE_SSM);
deleteExpiredPostsLambda.addEnvironment("NOTIFICATION_TABLE_SSM_PATH", NOTIFICATION_TABLE_SSM);
deleteExpiredPostsLambda.addEnvironment("STORAGE_BUCKET_SSM_PATH", STORAGE_BUCKET_SSM);

// ── viral-ranking-batch Lambda（10分ごとのスケジュール実行） ─────────────────
const viralRankingBatchLambda = backend.viralRankingBatch.resources.lambda as LambdaFunction;

new Rule(Stack.of(viralRankingBatchLambda), "ViralRankingBatchSchedule", {
  schedule: Schedule.rate(Duration.minutes(10)),
  targets: [new LambdaTarget(viralRankingBatchLambda)],
});

viralRankingBatchLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["dynamodb:Scan"],
    resources: ["arn:aws:dynamodb:*:*:table/Post-*"],
  })
);

viralRankingBatchLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["dynamodb:Query", "dynamodb:BatchWriteItem"],
    resources: ["arn:aws:dynamodb:*:*:table/ViralRanking-*"],
  })
);

viralRankingBatchLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["ssm:GetParameter"],
    resources: ["arn:aws:ssm:*:*:parameter/social-trim-sns/*"],
  })
);

viralRankingBatchLambda.addEnvironment("POST_TABLE_SSM_PATH", POST_TABLE_SSM);
viralRankingBatchLambda.addEnvironment("VIRAL_RANKING_TABLE_SSM_PATH", VIRAL_RANKING_TABLE_SSM);
