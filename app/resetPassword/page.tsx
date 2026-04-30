"use client";

import { confirmResetPassword, resetPassword } from "aws-amplify/auth";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { HiEye, HiEyeOff } from "react-icons/hi";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [isSendCode, setIsSendCode] = useState<boolean>(false);
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [confirmCode, setConfirmCode] = useState<string>("");
  const [errorText, setErrorText] = useState<string>("");
  const [successText, setSuccessText] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    switch (e.target.name) {
      case "confirmCode":
        setConfirmCode(e.target.value);
        break;
      case "password":
        setPassword(e.target.value);
        break;
      case "confirmPassword":
        setConfirmPassword(e.target.value);
        break;
    }
  };

  async function formSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorText("");
    if (confirmCode && email && password) {
      try {
        if (password !== confirmPassword) {
          throw new Error("パスワードが一致しません");
        }
        setLoading(true);
        await confirmResetPassword({
          username: email,
          confirmationCode: confirmCode,
          newPassword: password,
        });
        router.push("/signIn");
      } catch (error: unknown) {
        setErrorText(error instanceof Error ? error.message : "エラーが発生しました");
      } finally {
        setLoading(false);
      }
    } else {
      setErrorText("すべての項目を入力してください");
    }
  }

  async function sendConfirmCode(e: React.FormEvent) {
    e.preventDefault();
    setErrorText("");
    if (email) {
      try {
        setLoading(true);
        await resetPassword({ username: email });
        setIsSendCode(true);
      } catch (error: unknown) {
        setErrorText(error instanceof Error ? error.message : "エラーが発生しました");
      } finally {
        setLoading(false);
      }
    }
  }

  async function resendConfirmCode() {
    if (email) {
      try {
        await resetPassword({ username: email });
        setSuccessText("認証コードを再送しました。メールをご確認ください。");
      } catch (error: unknown) {
        setErrorText(error instanceof Error ? error.message : "エラーが発生しました");
      }
    }
  }

  const inputClass =
    "w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-500 transition-colors";

  if (isSendCode) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="text-gray-900 font-bold text-4xl mb-1 tracking-tight">trim</h1>
            <p className="text-gray-500 text-sm">シンプルに、きりとる。</p>
          </div>

          <div className="border border-gray-200 rounded-2xl p-6 shadow-sm">
            <h2 className="text-gray-900 font-bold text-lg mb-6">パスワードを再設定</h2>
            <form onSubmit={formSubmit} className="space-y-4">
              <div>
                <label className="block text-gray-700 text-sm mb-1">認証コード</label>
                <input
                  name="confirmCode"
                  placeholder="******"
                  value={confirmCode}
                  onChange={handleChange}
                  autoComplete="one-time-code"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-gray-700 text-sm mb-1">新しいパスワード</label>
                <div className="relative">
                  <input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="パスワード"
                    value={password}
                    onChange={handleChange}
                    autoComplete="new-password"
                    className={`${inputClass} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-3 flex items-center [background:none] text-gray-400 hover:text-gray-600"
                    aria-label={showPassword ? "パスワードを隠す" : "パスワードを表示"}
                  >
                    {showPassword ? <HiEyeOff size={20} /> : <HiEye size={20} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-gray-700 text-sm mb-1">新しいパスワード（確認）</label>
                <div className="relative">
                  <input
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="パスワード"
                    value={confirmPassword}
                    onChange={handleChange}
                    autoComplete="new-password"
                    className={`${inputClass} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute inset-y-0 right-3 flex items-center [background:none] text-gray-400 hover:text-gray-600"
                    aria-label={showConfirmPassword ? "パスワードを隠す" : "パスワードを表示"}
                  >
                    {showConfirmPassword ? <HiEyeOff size={20} /> : <HiEye size={20} />}
                  </button>
                </div>
              </div>
              {errorText && <p className="text-sm text-red-600 text-center">{errorText}</p>}
              {successText && <p className="text-sm text-green-600 text-center">{successText}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gray-900 hover:bg-gray-700 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? "処理中..." : "パスワードを再設定"}
              </button>
            </form>
          </div>

          <div className="text-center mt-4 space-y-2">
            <button
              type="button"
              onClick={resendConfirmCode}
              className="block w-full text-gray-600 hover:text-gray-900 text-sm"
            >
              認証コードを再送信
            </button>
            <Link href="/signIn" className="text-gray-600 hover:text-gray-900 text-sm">
              サインインに戻る
            </Link>
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
          <p className="text-gray-500 text-sm">シンプルに、きりとる。</p>
        </div>

        <div className="border border-gray-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-gray-900 font-bold text-lg mb-6">パスワードを再設定</h2>
          <form onSubmit={sendConfirmCode} className="space-y-4">
            <div>
              <label className="block text-gray-700 text-sm mb-1">メールアドレス</label>
              <input
                type="email"
                name="email"
                placeholder="info@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className={inputClass}
              />
            </div>
            {errorText && <p className="text-sm text-red-600 text-center">{errorText}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gray-900 hover:bg-gray-700 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? "処理中..." : "認証コードを送信"}
            </button>
          </form>
        </div>

        <div className="text-center mt-4">
          <Link href="/signIn" className="text-gray-600 hover:text-gray-900 text-sm">
            サインインに戻る
          </Link>
        </div>
      </div>
    </div>
  );
}
