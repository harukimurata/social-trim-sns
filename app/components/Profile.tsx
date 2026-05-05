"use client";

import { useRouter } from "next/navigation";

export type ProfileCellData = {
  userId: string;
  username: string;
  bio?: string | null;
  /** 署名付き済みの表示用URL（S3パスではない） */
  avatarUrl?: string;
};

/**
 * ユーザー一覧で使う1行プロフィールセル。タップでそのユーザーのプロフィール画面へ遷移する。
 */
export default function ProfileCell({ userId, username, bio, avatarUrl }: ProfileCellData) {
  const router = useRouter();
  const initial = username[0]?.toUpperCase() ?? "?";

  return (
    <button
      onClick={() => router.push(`/profile/${userId}`)}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-neutral-tertiary transition-colors text-left border-b border-default"
    >
      <div className="w-12 h-12 rounded-full bg-brand-500 flex items-center justify-center text-white font-bold shrink-0 overflow-hidden">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt={username} className="w-full h-full object-cover" />
        ) : (
          initial
        )}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold text-gray-800 truncate">{username}</p>
        {bio && <p className="text-xs text-gray-500 truncate">{bio}</p>}
      </div>
    </button>
  );
}
