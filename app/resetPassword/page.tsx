"use client";

import { confirmResetPassword, resetPassword } from "aws-amplify/auth";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { EyeCloseIcon, EyeIcon } from "@/app/icons";
import Label from "@/app/forms/Label";
import Input from "@/app/forms/input/InputField";
import Button from "@/app/components/ui/button/Button";
import { useMsg } from "@/contexts/MsgContext";

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

  const { showMsg } = useMsg();

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
        await confirmResetPassword({
          username: email,
          confirmationCode: confirmCode,
          newPassword: password,
        });
        router.push("/signIn");
      } catch (error: unknown) {
        setErrorText(error instanceof Error ? error.message : "エラーが発生しました");
      }
    } else {
      setErrorText("すべての項目を入力してください");
    }
  }

  async function sendConfirmCode(e: React.FormEvent) {
    e.preventDefault();
    if (email) {
      try {
        await resetPassword({ username: email });
        setIsSendCode(true);
      } catch (error: unknown) {
        setErrorText(error instanceof Error ? error.message : "エラーが発生しました");
      }
    }
  }

  async function resendConfirmCode() {
    if (email) {
      try {
        await resetPassword({ username: email });
        showMsg("認証コードの再発行", "登録したメールアドレス宛に送信しました。", "閉じる", "info");
      } catch (error: unknown) {
        setErrorText(error instanceof Error ? error.message : "エラーが発生しました");
      }
    }
  }

  if (isSendCode) {
    return (
      <div className="flex flex-col min-h-screen">
        <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto px-4">
          <div>
            <div className="mb-5 sm:mb-8">
              <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
                パスワードを再設定
              </h1>
            </div>
            <form onSubmit={formSubmit}>
              <div className="space-y-6">
                <div>
                  <Label>
                    認証コード <span className="text-error-500">*</span>
                  </Label>
                  <Input
                    name="confirmCode"
                    placeholder="******"
                    value={confirmCode}
                    onChange={handleChange}
                    autoComplete="one-time-code"
                  />
                </div>
                <div>
                  <Label>
                    新しいパスワード <span className="text-error-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="パスワード"
                      value={password}
                      onChange={handleChange}
                      autoComplete="new-password"
                    />
                    <span
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                    >
                      {showPassword ? (
                        <EyeIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                      ) : (
                        <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                      )}
                    </span>
                  </div>
                </div>
                <div>
                  <Label>
                    新しいパスワード（確認） <span className="text-error-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      name="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="パスワード"
                      value={confirmPassword}
                      onChange={handleChange}
                      autoComplete="new-password"
                    />
                    <span
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                    >
                      {showConfirmPassword ? (
                        <EyeIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                      ) : (
                        <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                      )}
                    </span>
                  </div>
                </div>
                {errorText && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-500">{errorText}</p>
                )}
                <Button className="w-full" size="sm" type="submit">
                  パスワードを再設定
                </Button>
              </div>
            </form>
            <Button className="w-full mt-2" size="sm" onClick={resendConfirmCode}>
              認証コードを再送信
            </Button>
            <Link href="/signIn" className="text-sm text-brand-500 hover:text-brand-600 dark:text-brand-400">
              サインインに戻る
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto px-4">
        <div>
          <div className="mb-5 sm:mb-8">
            <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
              パスワードを再設定
            </h1>
          </div>
          <form onSubmit={sendConfirmCode}>
            <div className="space-y-6">
              <div>
                <Label>
                  メールアドレス <span className="text-error-500">*</span>
                </Label>
                <Input
                  name="email"
                  placeholder="info@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              {errorText && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-500">{errorText}</p>
              )}
              <Button className="w-full" size="sm" type="submit">
                認証コードを送信
              </Button>
            </div>
          </form>
          <Link href="/signIn" className="text-sm text-brand-500 hover:text-brand-600 dark:text-brand-400">
            サインインに戻る
          </Link>
        </div>
      </div>
    </div>
  );
}
