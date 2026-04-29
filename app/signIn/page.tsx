"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn, signOut } from "aws-amplify/auth";

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);

  async function formSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signOut().catch(() => { });
      await signIn({ username: email, password });
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ログインに失敗しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-gray-900 font-bold text-4xl mb-1 tracking-tight">trim</h1>
          <p className="text-gray-500 text-sm">シンプルに、つながる。</p>
        </div>

        <div className="border border-gray-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-gray-900 font-bold text-lg mb-6">ログイン</h2>
          <form onSubmit={formSubmit} className="space-y-4">
            <div>
              <label className="block text-gray-700 text-sm mb-1">メールアドレス</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                autoComplete="email"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-gray-700 text-sm mb-1">パスワード</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="パスワード"
                autoComplete="current-password"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-500 transition-colors"
              />
            </div>
            <div className="flex justify-end">
              <Link href="/resetPassword" className="text-xs text-gray-500 hover:text-gray-700">
                パスワードをお忘れの方
              </Link>
            </div>
            {error && (
              <p className="text-sm text-red-600 text-center">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gray-900 hover:bg-gray-700 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? "処理中..." : "ログイン"}
            </button>
          </form>
        </div>

        <div className="text-center mt-4">
          <Link href="/signUp" className="text-gray-600 hover:text-gray-900 text-sm">
            アカウントをお持ちでない方はこちら
          </Link>
        </div>
      </div>
    </div>
  );
}
