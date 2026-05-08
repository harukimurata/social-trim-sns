import { defineFunction } from "@aws-amplify/backend";

export const commentReactionStreamHandler = defineFunction({
  name: "comment-reaction-stream-handler",
  entry: "./handler.ts",
});
