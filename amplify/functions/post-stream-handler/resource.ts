import { defineFunction } from "@aws-amplify/backend";

export const postStreamHandler = defineFunction({
  name: "post-stream-handler",
  entry: "./handler.ts",
});
