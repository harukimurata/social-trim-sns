import { defineFunction } from "@aws-amplify/backend";

export const followStreamHandler = defineFunction({
  name: "follow-stream-handler",
  entry: "./handler.ts",
});
