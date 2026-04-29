import { defineBackend } from "@aws-amplify/backend";
import { auth } from "./auth/resource.js";
import { data } from "./data/resource.js";
import { postConfirmation } from "./auth/post-confirmation/resource.js";

defineBackend({
  auth,
  data,
  postConfirmation,
});
