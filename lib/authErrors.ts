const ERROR_MAP: Record<string, string> = {
  NotAuthorizedException: "ユーザー名またはパスワードが正しくありません",
  UserNotFoundException: "このメールアドレスは登録されていません",
  UserNotConfirmedException: "メールアドレスの確認が完了していません",
  UsernameExistsException: "このメールアドレスはすでに登録されています",
  CodeMismatchException: "確認コードが正しくありません",
  ExpiredCodeException: "確認コードの有効期限が切れています。再送信してください",
  TooManyRequestsException: "しばらく時間をおいてから再試行してください",
  LimitExceededException: "試行回数が上限に達しました。しばらく時間をおいてから再試行してください",
  InvalidPasswordException: "パスワードが要件を満たしていません（8文字以上、大文字・小文字・数字を含む）",
  InvalidParameterException: "入力内容が正しくありません",
  NetworkError: "ネットワークエラーが発生しました",
  FetchError: "ネットワークエラーが発生しました",
};

export function getAuthErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.name in ERROR_MAP) {
    return ERROR_MAP[err.name];
  }
  return fallback;
}
