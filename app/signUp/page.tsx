"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signUp, confirmSignUp, signIn } from "aws-amplify/auth";

type Mode = "signup" | "confirm";

export default function SignUp() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmationCode, setConfirmationCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function formSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signUp({
        username: email,
        password,
        options: {
          userAttributes: { email },
        },
      });
      setMode("confirm");
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await confirmSignUp({ username: email, confirmationCode });
      try {
        await signIn({ username: email, password });
      } catch {
        router.push("/signIn");
        return;
      }
      router.push("/feed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "確認コードが正しくありません");
    } finally {
      setLoading(false);
    }
  }

  if (mode === "confirm") {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="text-gray-900 font-bold text-4xl mb-1 tracking-tight">trim</h1>
            <p className="text-gray-500 text-sm">{email} に確認コードを送信しました</p>
          </div>
          <div className="border border-gray-200 rounded-2xl p-6 shadow-sm">
            <form onSubmit={handleConfirm} className="space-y-4">
              <div>
                <label className="block text-gray-700 text-sm mb-1">確認コード</label>
                <input
                  type="text"
                  value={confirmationCode}
                  onChange={(e) => setConfirmationCode(e.target.value)}
                  placeholder="確認コード"
                  autoComplete="one-time-code"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-500 transition-colors"
                />
              </div>
              {error && <p className="text-sm text-red-600 text-center">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gray-900 hover:bg-gray-700 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? "確認中..." : "確認する"}
              </button>
            </form>
          </div>
          <div className="text-center mt-4">
            <button
              onClick={() => setMode("signup")}
              className="text-gray-600 hover:text-gray-900 text-sm"
            >
              登録情報を修正する
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-gray-900 font-bold text-4xl mb-1 tracking-tight">trim</h1>
          <p className="text-gray-500 text-sm">新規登録</p>
        </div>

        <div className="border border-gray-200 rounded-2xl p-6 shadow-sm">
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
                placeholder="8文字以上"
                autoComplete="new-password"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-500 transition-colors"
              />
            </div>
            {error && <p className="text-sm text-red-600 text-center">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gray-900 hover:bg-gray-700 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? "処理中..." : "登録して始める"}
            </button>
          </form>
        </div>

        <div className="text-center mt-4">
          <Link href="/signIn" className="text-gray-600 hover:text-gray-900 text-sm">
            既にアカウントをお持ちの方はこちら
          </Link>
        </div>
      </div>
    </div>
  );
}
