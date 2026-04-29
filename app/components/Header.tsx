"use client";

import { usePathname, useRouter } from "next/navigation";
import { signOut } from "aws-amplify/auth";
import { useState } from "react";

const AUTH_PATHS = ["/signIn", "/signUp", "/resetPassword"];

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (AUTH_PATHS.some((p) => pathname.startsWith(p))) {
    return null;
  }

  async function handleSignOut() {
    setLoading(true);
    try {
      await signOut();
      router.push("/signIn");
    } finally {
      setLoading(false);
    }
  }

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
      <span className="text-gray-900 font-bold text-xl tracking-tight">trim</span>
      <button
        onClick={handleSignOut}
        disabled={loading}
        className="text-sm text-gray-500 hover:text-gray-900 transition-colors disabled:opacity-50"
      >
        {loading ? "処理中..." : "サインアウト"}
      </button>
    </header>
  );
}
