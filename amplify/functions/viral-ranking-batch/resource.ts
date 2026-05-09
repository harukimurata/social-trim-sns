import { defineFunction } from "@aws-amplify/backend";

export const viralRankingBatch = defineFunction({
  name: "viral-ranking-batch",
  entry: "./handler.ts",
  timeoutSeconds: 300,
});
