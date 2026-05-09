import { defineFunction } from "@aws-amplify/backend";

export const deleteExpiredPosts = defineFunction({
  name: "delete-expired-posts",
  entry: "./handler.ts",
  timeoutSeconds: 300,
});
