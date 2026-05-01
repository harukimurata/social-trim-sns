"use client";

import { useState, useEffect } from "react";
import { getCurrentUser } from "aws-amplify/auth";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { HiPencil } from "react-icons/hi";

const client = generateClient<Schema>();

type ProfileData = {
  userId: string;
  username: string;
  bio: string | null | undefined;
  avatarUrl: string | null | undefined;
  totalPostCount: number | null | undefined;
  protectedPostCount: number | null | undefined;
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
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchProfile() {
      try {
        const { userId } = await getCurrentUser();
        const { data } = await client.models.User.get({ userId });
        if (data) {
          setProfile({
            userId: data.userId,
            username: data.username,
            bio: data.bio,
            avatarUrl: data.avatarUrl,
            totalPostCount: data.totalPostCount,
            protectedPostCount: data.protectedPostCount,
            birthdate: data.birthdate,
            mainUrl: data.mainUrl,
            mainArea: data.mainArea,
          });
        }
      } catch {
        setError("プロフィールの取得に失敗しました");
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, []);

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

  function cancelEdit() {
    setEditing(false);
    setError("");
  }

  async function saveProfile() {
    if (!profile) return;
    if (!editUsername.trim()) {
      setError("ユーザー名は必須です");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { data } = await client.models.User.update({
        userId: profile.userId,
        username: editUsername.trim(),
        bio: editBio.trim() || null,
        birthdate: editBirthdate || null,
        mainUrl: editMainUrl.trim() || null,
        mainArea: editMainArea.trim() || null,
      });
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
            }
            : prev
        );
      }
      setEditing(false);
    } catch {
      setError("プロフィールの更新に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="px-4 py-6">
        <p className="text-gray-400 text-sm">読み込み中...</p>
      </main>
    );
  }

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

  return (
    <main className="px-4 py-6 max-w-lg">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-heading">プロフィール</h1>
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
        <div className="w-20 h-20 rounded-full bg-brand-500 flex items-center justify-center text-white text-2xl font-bold overflow-hidden shrink-0">
          {profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatarUrl}
              alt={profile.username}
              className="w-full h-full object-cover"
            />
          ) : (
            avatarInitial
          )}
        </div>

        {!editing ? (
          <div>
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

      {/* 誕生日 / メインURL / メインエリア（閲覧モード） */}
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
