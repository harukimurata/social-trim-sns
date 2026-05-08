import { defineFunction } from "@aws-amplify/backend";

export const commentStreamHandler = defineFunction({
  name: "comment-stream-handler",
  entry: "./handler.ts",
});
