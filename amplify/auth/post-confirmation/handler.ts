import type { PostConfirmationTriggerHandler } from "aws-lambda";

export const handler: PostConfirmationTriggerHandler = async (event) => {
  const { userName } = event;

  // TODO: Counters テーブルから sequentialUserId を採番し、Users テーブルへ書き込む
  // 1. CountersTable の USER_SEQ を ADD 1 してアトミックに sequentialUserId を取得
  // 2. UsersTable に { userId: sub, sequentialUserId, username: "", bio: "", avatarUrl: "", createdAt } を書き込む
  console.log("Post confirmation for user:", userName);

  return event;
};
