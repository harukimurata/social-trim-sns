"use client";

import { useState, useEffect, useRef } from "react";
import { getCurrentUser, fetchAuthSession } from "aws-amplify/auth";
import { uploadData, getUrl, remove } from "aws-amplify/storage";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { useSetAtom } from "jotai";
import { avatarAtom } from "@/lib/atoms/avatarAtom";
import { HiPencil, HiCamera, HiX } from "react-icons/hi";

const client = generateClient<Schema>();

type ProfileData = {
  userId: string;
  sequentialUserId: number | null | undefined;
  username: string;
  bio: string | null | undefined;
  avatarUrl: string | null | undefined;
  totalPostCount: number | null | undefined;
  protectedPostCount: number | null | undefined;
  followingCount: number | null | undefined;
  followerCount: number | null | undefined;
  birthdate: string | null | undefined;
  mainUrl: string | null | undefined;
  mainArea: string | null | undefined;
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editUsername, setEditUsername] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editBirthdate, setEditBirthdate] = useState("");
  const [editMainUrl, setEditMainUrl] = useState("");
  const [editMainArea, setEditMainArea] = useState("");
  const [saving, setSaving] = useState(false);
  const [avatarDisplayUrl, setAvatarDisplayUrl] = useState("");
  const setAvatar = useSetAtom(avatarAtom);
  // 編集中の一時的なアバター状態
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [pendingAvatarPreviewUrl, setPendingAvatarPreviewUrl] = useState("");
  const [avatarClearRequested, setAvatarClearRequested] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // マウント時にログイン中ユーザーのプロフィールを取得し、アバターのS3署名付きURLを解決する
  useEffect(() => {
    async function fetchProfile() {
      try {
        const { userId } = await getCurrentUser();
        const { data } = await client.models.User.get({ userId });
        if (data) {
          setProfile({
            userId: data.userId,
            sequentialUserId: data.sequentialUserId,
            username: data.username,
            bio: data.bio,
            avatarUrl: data.avatarUrl,
            totalPostCount: data.totalPostCount,
            protectedPostCount: data.protectedPostCount,
            followingCount: data.followingCount,
            followerCount: data.followerCount,
            birthdate: data.birthdate,
            mainUrl: data.mainUrl,
            mainArea: data.mainArea,
          });
          // アバターが設定されている場合のみ署名付きURLを取得
          if (data.avatarUrl) {
            const { url } = await getUrl({ path: data.avatarUrl });
            setAvatarDisplayUrl(url.toString());
          }
        }
      } catch {
        setError("プロフィールの取得に失敗しました");
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, []);

  // 編集モードへ切り替え、現在のプロフィール値をフォームの初期値にセットする
  function startEdit() {
    if (!profile) return;
    setEditUsername(profile.username ?? "");
    setEditBio(profile.bio ?? "");
    setEditBirthdate(profile.birthdate ?? "");
    setEditMainUrl(profile.mainUrl ?? "");
    setEditMainArea(profile.mainArea ?? "");
    setError("");
    setEditing(true);
  }

  // 編集をキャンセルし、未アップロードのプレビューURLを解放して状態をリセットする
  function cancelEdit() {
    if (pendingAvatarPreviewUrl) URL.revokeObjectURL(pendingAvatarPreviewUrl);
    setPendingAvatarFile(null);
    setPendingAvatarPreviewUrl("");
    setAvatarClearRequested(false);
    setEditing(false);
    setError("");
  }

  // ファイル選択時はローカルプレビューのみ。実際のアップロードは saveProfile で行う。
  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // 画像ファイル以外はエラー
    if (!file.type.startsWith("image/")) {
      setError("画像ファイルを選択してください");
      return;
    }
    // 10MB超過はエラー
    if (file.size > 10 * 1024 * 1024) {
      setError("ファイルサイズは10MB以下にしてください");
      return;
    }

    if (pendingAvatarPreviewUrl) URL.revokeObjectURL(pendingAvatarPreviewUrl);
    setPendingAvatarFile(file);
    setPendingAvatarPreviewUrl(URL.createObjectURL(file));
    setAvatarClearRequested(false);
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // アバター削除フラグを立て、プレビューをクリアする（S3削除は saveProfile で行う）
  function handleAvatarClear() {
    if (pendingAvatarPreviewUrl) URL.revokeObjectURL(pendingAvatarPreviewUrl);
    setPendingAvatarFile(null);
    setPendingAvatarPreviewUrl("");
    setAvatarClearRequested(true);
    setError("");
  }

  // 編集内容をDBに保存し、必要に応じてS3のアバター画像をアップロード／削除する
  async function saveProfile() {
    if (!profile) return;
    // ユーザー名は必須
    if (!editUsername.trim()) {
      setError("ユーザー名は必須です");
      return;
    }
    setSaving(true);
    setError("");
    try {
      // 新しい画像が選択されている場合はS3へアップロード
      let newAvatarPath: string | undefined;
      if (pendingAvatarFile) {
        const session = await fetchAuthSession();
        const identityId = session.identityId;
        if (!identityId) throw new Error("identityId not found");

        const ext = pendingAvatarFile.name.split(".").pop() ?? "jpg";
        newAvatarPath = `avatars/${identityId}/avatar.${ext}`;
        await uploadData({ path: newAvatarPath, data: pendingAvatarFile }).result;
      }

      // 削除フラグが立っており、既存アバターがある場合はS3から削除
      if (avatarClearRequested && profile.avatarUrl) {
        await remove({ path: profile.avatarUrl });
      }

      // アバター変更内容に応じてDB更新パッチを決定:
      // 新画像あり → 新パス、削除フラグあり → null、変更なし → パッチなし
      const avatarPatch = newAvatarPath
        ? { avatarUrl: newAvatarPath }
        : avatarClearRequested
          ? { avatarUrl: null as null }
          : {};

      const { data } = await client.models.User.update({
        userId: profile.userId,
        username: editUsername.trim(),
        bio: editBio.trim() || null,
        birthdate: editBirthdate || null,
        mainUrl: editMainUrl.trim() || null,
        mainArea: editMainArea.trim() || null,
        ...avatarPatch,
      });

      // 表示用URLを更新し、Navbarにも反映
      const newInitial = editUsername.trim()[0].toUpperCase();
      if (newAvatarPath) {
        // 新しいアバターを設定した場合
        const { url } = await getUrl({ path: newAvatarPath });
        setAvatarDisplayUrl(url.toString());
        setAvatar({ initial: newInitial, displayUrl: url.toString() });
      } else if (avatarClearRequested) {
        // アバターを削除した場合
        setAvatarDisplayUrl("");
        setAvatar({ initial: newInitial, displayUrl: "" });
      } else {
        // アバター変更なし（イニシャルのみ更新）
        setAvatar((prev) => ({ ...prev, initial: newInitial }));
      }

      if (data) {
        setProfile((prev) =>
          prev
            ? {
              ...prev,
              username: data.username,
              bio: data.bio,
              birthdate: data.birthdate,
              mainUrl: data.mainUrl,
              mainArea: data.mainArea,
              ...(newAvatarPath
                ? { avatarUrl: newAvatarPath }
                : avatarClearRequested
                  ? { avatarUrl: null }
                  : {}),
            }
            : prev
        );
      }

      if (pendingAvatarPreviewUrl) URL.revokeObjectURL(pendingAvatarPreviewUrl);
      setPendingAvatarFile(null);
      setPendingAvatarPreviewUrl("");
      setAvatarClearRequested(false);
      setEditing(false);
    } catch {
      setError("プロフィールの更新に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  // データ取得中はローディング表示
  if (loading) {
    return (
      <main className="px-4 py-6">
        <p className="text-gray-400 text-sm">読み込み中...</p>
      </main>
    );
  }

  // プロフィールが取得できなかった場合はエラー表示
  if (!profile) {
    return (
      <main className="px-4 py-6">
        <p className="text-red-500 text-sm">
          {error || "プロフィールが見つかりません"}
        </p>
      </main>
    );
  }

  const avatarInitial = profile.username
    ? profile.username[0].toUpperCase()
    : "?";

  // 編集モード中のアバター表示: 選択済みプレビュー > 削除フラグ > 既存URL
  const editingAvatarSrc = pendingAvatarPreviewUrl
    ? pendingAvatarPreviewUrl
    : avatarClearRequested
      ? ""
      : avatarDisplayUrl;
  const currentAvatarSrc = editing ? editingAvatarSrc : avatarDisplayUrl;
  const showClearButton = editing && !!editingAvatarSrc;

  return (
    <main className="px-4 py-6 max-w-lg">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-heading">プロフィール</h1>
        {/* 閲覧モードのみ編集ボタンを表示 */}
        {!editing && (
          <button
            onClick={startEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-default text-body hover:bg-neutral-tertiary transition-colors"
          >
            <HiPencil size={16} />
            編集
          </button>
        )}
      </div>

      {/* アバター + ユーザー名 */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative shrink-0">
          <div className="w-20 h-20 rounded-full bg-brand-500 flex items-center justify-center text-white text-2xl font-bold overflow-hidden">
            {/* アバターURLがあれば画像、なければイニシャルを表示 */}
            {currentAvatarSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentAvatarSrc}
                alt={profile.username}
                className="w-full h-full object-cover"
              />
            ) : (
              avatarInitial
            )}
          </div>
          {/* カメラボタン: 編集モードでホバー表示 */}
          {editing && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={saving}
              className="absolute inset-0 rounded-full flex items-center justify-center bg-black/40 text-white opacity-0 hover:opacity-100 transition-opacity disabled:cursor-not-allowed"
              aria-label="アイコン画像を変更"
            >
              <HiCamera size={24} />
            </button>
          )}
          {/* 削除ボタン: 編集モードかつアバターが存在する場合に表示 */}
          {showClearButton && (
            <button
              type="button"
              onClick={handleAvatarClear}
              disabled={saving}
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gray-700 text-white flex items-center justify-center hover:bg-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="アイコン画像を削除"
            >
              <HiX size={10} />
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>

        {/* 閲覧モード: ユーザー名・bio表示 / 編集モード: ユーザー名入力フォーム */}
        {!editing ? (
          <div>
            {profile.sequentialUserId != null && (
              <p className="text-xs text-gray-400 mb-0.5">ID: {profile.sequentialUserId}</p>
            )}
            <p className="text-lg font-bold text-gray-500">{profile.username}</p>
            {profile.bio && (
              <p className="text-sm text-gray-500 mt-0.5 whitespace-pre-wrap">
                {profile.bio}
              </p>
            )}
          </div>
        ) : (
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">
              ユーザー名
            </label>
            <input
              type="text"
              value={editUsername}
              onChange={(e) => setEditUsername(e.target.value)}
              maxLength={50}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-gray-500 transition-colors"
            />
          </div>
        )}
      </div>

      {/* 自己紹介（編集モード） */}
      {editing && (
        <div className="mb-4">
          <label className="block text-xs text-gray-500 mb-1">自己紹介</label>
          <textarea
            value={editBio}
            onChange={(e) => setEditBio(e.target.value)}
            maxLength={160}
            rows={10}
            placeholder="自己紹介を入力..."
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-500 transition-colors resize-none"
          />
          <p className="text-xs text-gray-400 text-right mt-0.5">
            {editBio.length} / 160
          </p>
        </div>
      )}

      {/* 誕生日 / メインURL / メインエリア（編集モード） */}
      {editing && (
        <div className="space-y-4 mb-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">誕生日</label>
            <input
              type="date"
              value={editBirthdate}
              onChange={(e) => setEditBirthdate(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-gray-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              メインURL
            </label>
            <input
              type="url"
              value={editMainUrl}
              onChange={(e) => setEditMainUrl(e.target.value)}
              maxLength={200}
              placeholder="https://example.com"
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              メインエリア
            </label>
            <input
              type="text"
              value={editMainArea}
              onChange={(e) => setEditMainArea(e.target.value)}
              maxLength={50}
              placeholder="東京都"
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-500 transition-colors"
            />
          </div>
        </div>
      )}

      {/* 誕生日 / メインURL / メインエリア（閲覧モード）: いずれか1つでも値があれば表示 */}
      {!editing &&
        (profile.birthdate || profile.mainUrl || profile.mainArea) && (
          <div className="space-y-1.5 mb-6 text-sm text-gray-600">
            {profile.birthdate && (
              <p>
                <span className="text-gray-400 mr-2">誕生日</span>
                {profile.birthdate}
              </p>
            )}
            {profile.mainUrl && (
              <p>
                <span className="text-gray-400 mr-2">URL</span>
                <a
                  href={profile.mainUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline break-all"
                >
                  {profile.mainUrl}
                </a>
              </p>
            )}
            {profile.mainArea && (
              <p>
                <span className="text-gray-400 mr-2">エリア</span>
                {profile.mainArea}
              </p>
            )}
          </div>
        )}

      {/* 統計（閲覧モード） */}
      {!editing && (
        <div className="flex gap-8 mb-6 border-t border-default pt-4">
          <div>
            <p className="text-xl font-bold text-gray-400">
              {profile.followingCount ?? 0}
            </p>
            <p className="text-xs text-gray-500">フォロー</p>
          </div>
          <div>
            <p className="text-xl font-bold text-gray-400">
              {profile.followerCount ?? 0}
            </p>
            <p className="text-xs text-gray-500">フォロワー</p>
          </div>
          <div>
            <p className="text-xl font-bold text-gray-400">
              {profile.totalPostCount ?? 0}
            </p>
            <p className="text-xs text-gray-500">累計投稿数</p>
          </div>
          <div>
            <p className="text-xl font-bold text-gray-400">
              {profile.protectedPostCount ?? 0}
              <span className="text-sm font-normal text-gray-400"> / 5</span>
            </p>
            <p className="text-xs text-gray-500">保護中の投稿</p>
          </div>
        </div>
      )}

      {/* エラー */}
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {/* 編集アクション */}
      {editing && (
        <div className="flex gap-3">
          <button
            onClick={saveProfile}
            disabled={saving}
            className="flex-1 bg-gray-900 hover:bg-gray-700 text-white font-bold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {saving ? "保存中..." : "保存する"}
          </button>
          <button
            onClick={cancelEdit}
            disabled={saving}
            className="flex-1 border border-gray-300 text-gray-700 font-bold py-2.5 rounded-lg text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            キャンセル
          </button>
        </div>
      )}
    </main>
  );
}
