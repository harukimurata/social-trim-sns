import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { fetchAuthSession } from "aws-amplify/auth/server";
import { cookies } from "next/headers";
import { runWithAmplifyServerContext } from "@/utils/amplifyServerUtils";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  const session = await runWithAmplifyServerContext({
    nextServerContext: { cookies },
    operation: async (contextSpec) => {
      try {
        return await fetchAuthSession(contextSpec, {});
      } catch (err) {
        console.error("[middleware] fetchAuthSession failed:", err);
        return null;
      }
    },
  });

  const isAuthenticated = !!session?.tokens?.idToken;

  if (!isAuthenticated) {
    return NextResponse.redirect(new URL("/signIn", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!signIn|signUp|resetPassword|_next/static|_next/image|favicon.ico).*)"],
};
