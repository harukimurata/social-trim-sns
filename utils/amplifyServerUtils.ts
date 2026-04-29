import { cookies } from "next/headers";

import { createServerRunner } from "@aws-amplify/adapter-nextjs";
import { generateServerClientUsingCookies } from "@aws-amplify/adapter-nextjs/data";

// amplify_outputs.json は `amplify sandbox` 実行後に生成される
// eslint-disable-next-line @typescript-eslint/no-require-imports
const outputs = require("@/amplify_outputs.json");

export const { runWithAmplifyServerContext } = createServerRunner({
  config: outputs,
});

export const cookieBasedClient = generateServerClientUsingCookies({
  config: outputs,
  cookies,
});
