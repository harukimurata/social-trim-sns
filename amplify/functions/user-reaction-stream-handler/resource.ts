import { defineFunction } from "@aws-amplify/backend";

export const userReactionStreamHandler = defineFunction({
  name: "user-reaction-stream-handler",
  entry: "./handler.ts",
});
