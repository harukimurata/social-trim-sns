"use client";

import { Amplify } from "aws-amplify";

// amplify_outputs.json は `amplify sandbox` 実行後に生成される
// eslint-disable-next-line @typescript-eslint/no-require-imports
const outputs = require("@/amplify_outputs.json");

Amplify.configure(outputs, { ssr: true });

export const ConfigureAmplifyClientSide = () => {
  return null;
};
