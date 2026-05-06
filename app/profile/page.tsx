"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import MarkdownContent from "@/app/components/MarkdownContent";
import { getCurrentUser, fetchAuthSession } from "aws-amplify/auth";
import { uploadData, getUrl, remove } from "aws-amplify/storage";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { useSetAtom } from "jotai";
import { avatarAtom } from "@/lib/atoms/avatarAtom";
import { useRouter } from "next/navigation";
import PostContent from "@/app/components/PostContent";
import { HiPencil, HiCamera, HiX, HiLockClosed, HiLockOpen, HiOutlineLightningBolt } from "react-icons/hi";
import { HiOutlineStar, HiStar } from "react-icons/hi2";
import { FaRegComment } from "react-icons/fa";

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

type ProfilePost = {
  id: string;
  content: string;
  originalContent?: string | null;
  isEdited: boolean;
  hashtags: string[];
  favoriteCount: number;
  viralCount: number;
  ttl?: number | null;
  isProtected: boolean;
  createdAt: string;
};

type FavoritePost = {
  id: string;
  userId: string;
  content: string;
  originalContent?: string | null;
  isEdited: boolean;
  imageUrls: string[];
  hashtags: string[];
  favoriteCount: number;
  viralCount: number;
  ttl?: number | null;
  isProtected: boolean;
  createdAt: string;
  username: string;
  userInitial: string;
  avatarUrl?: string;
};

function formatRelativeDate(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "たった今";
  if (diffMins < 60) return `${diffMins}分前`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}時間前`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}日前`;
  return new Date(isoString).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatUnixTimestamp(unix: number): string {
  return new Date(unix * 1000).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ProfilePage() {
  const router = useRouter();

  // プロフィール状態
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
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [pendingAvatarPreviewUrl, setPendingAvatarPreviewUrl] = useState("");
  const [avatarClearRequested, setAvatarClearRequested] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // タブ状態
  const [activeTab, setActiveTab] = useState<"posts" | "favorites">("posts");

  // 投稿状態
  const [posts, setPosts] = useState<ProfilePost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editPostContent, setEditPostContent] = useState("");
  const [savingPostEdit, setSavingPostEdit] = useState(false);
  const [protectingPostId, setProtectingPostId] = useState<string | null>(null);
  const [postError, setPostError] = useState("");
  const [showOriginalMap, setShowOriginalMap] = useState<Record<string, boolean>>({});

  // お気に入り状態
  const [favoritePosts, setFavoritePosts] = useState<FavoritePost[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());

  // マウント時にプロフィールと投稿を並列取得する
  useEffect(() => {
    async function fetchAll() {
      try {
        const { userId } = await getCurrentUser();
        const [userData, postsData] = await Promise.all([
          client.models.User.get({ userId }),
          client.models.Post.listPostByUserId({ userId }),
        ]);

        if (userData.data) {
          const d = userData.data;
          setProfile({
            userId: d.userId,
            sequentialUserId: d.sequentialUserId,
            username: d.username,
            bio: d.bio,
            avatarUrl: d.avatarUrl,
            totalPostCount: d.totalPostCount,
            protectedPostCount: d.protectedPostCount,
            followingCount: d.followingCount,
            followerCount: d.followerCount,
            birthdate: d.birthdate,
            mainUrl: d.mainUrl,
            mainArea: d.mainArea,
          });
          if (d.avatarUrl) {
            const { url } = await getUrl({ path: d.avatarUrl });
            setAvatarDisplayUrl(url.toString());
          }
        }

        const sorted = (postsData.data ?? []).sort(
          (a, b) =>
            new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
        );
        setPosts(
          sorted.map((p) => ({
            id: p.id,
            content: p.content,
            originalContent: p.originalContent,
            isEdited: p.isEdited ?? false,
            hashtags: p.hashtags?.filter((h): h is string => !!h) ?? [],
            favoriteCount: p.favoriteCount ?? 0,
            viralCount: p.viralCount ?? 0,
            ttl: p.ttl,
            isProtected: p.isProtected ?? false,
            createdAt: p.createdAt ?? "",
          }))
        );

        // 現在ユーザーのお気に入りIDを取得する
        const { data: reactions } = await client.models.UserReaction.listUserReactionByUserId({ userId });
        setFavoritedIds(
          new Set((reactions ?? []).filter((r) => r.type === "FAVORITE").map((r) => r.postId))
        );
      } catch {
        setError("プロフィールの取得に失敗しました");
      } finally {
        setLoading(false);
        setPostsLoading(false);
      }
    }
    fetchAll();
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

    if (!file.type.startsWith("image/")) {
      setError("画像ファイルを選択してください");
      return;
    }
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
    if (!editUsername.trim()) {
      setError("ユーザー名は必須です");
      return;
    }
    setSaving(true);
    setError("");
    try {
      let newAvatarPath: string | undefined;
      if (pendingAvatarFile) {
        const session = await fetchAuthSession();
        const identityId = session.identityId;
        if (!identityId) throw new Error("identityId not found");

        const ext = pendingAvatarFile.name.split(".").pop() ?? "jpg";
        newAvatarPath = `avatars/${identityId}/avatar.${ext}`;
        await uploadData({ path: newAvatarPath, data: pendingAvatarFile }).result;
      }

      if (avatarClearRequested && profile.avatarUrl) {
        await remove({ path: profile.avatarUrl });
      }

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

      const newInitial = editUsername.trim()[0].toUpperCase();
      if (newAvatarPath) {
        const { url } = await getUrl({ path: newAvatarPath });
        setAvatarDisplayUrl(url.toString());
        setAvatar({ initial: newInitial, displayUrl: url.toString() });
      } else if (avatarClearRequested) {
        setAvatarDisplayUrl("");
        setAvatar({ initial: newInitial, displayUrl: "" });
      } else {
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

  // 保護設定を切り替える。保護時は ttl を削除し、解除時は ttl = now + 7日 を再設定する
  async function toggleProtect(post: ProfilePost) {
    if (!profile) return;
    if (!post.isProtected && (profile.protectedPostCount ?? 0) >= 5) {
      setPostError("保護できる投稿は最大5件です。保護を解除してから設定してください。");
      return;
    }
    setProtectingPostId(post.id);
    setPostError("");
    try {
      if (post.isProtected) {
        const newTtl = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
        await client.models.Post.update({ id: post.id, isProtected: false, ttl: newTtl });
        await client.models.User.update({
          userId: profile.userId,
          protectedPostCount: Math.max(0, (profile.protectedPostCount ?? 1) - 1),
        });
        setPosts((prev) =>
          prev.map((p) => (p.id === post.id ? { ...p, isProtected: false, ttl: newTtl } : p))
        );
        setProfile((prev) =>
          prev
            ? { ...prev, protectedPostCount: Math.max(0, (prev.protectedPostCount ?? 1) - 1) }
            : prev
        );
      } else {
        await client.models.Post.update({ id: post.id, isProtected: true, ttl: null });
        await client.models.User.update({
          userId: profile.userId,
          protectedPostCount: (profile.protectedPostCount ?? 0) + 1,
        });
        setPosts((prev) =>
          prev.map((p) => (p.id === post.id ? { ...p, isProtected: true, ttl: null } : p))
        );
        setProfile((prev) =>
          prev
            ? { ...prev, protectedPostCount: (prev.protectedPostCount ?? 0) + 1 }
            : prev
        );
      }
    } catch {
      setPostError("保護設定の変更に失敗しました");
    } finally {
      setProtectingPostId(null);
    }
  }

  function startEditPost(post: ProfilePost) {
    setEditingPostId(post.id);
    setEditPostContent(post.content);
    setPostError("");
  }

  function cancelEditPost() {
    setEditingPostId(null);
    setEditPostContent("");
  }

  // 投稿を編集する（1回のみ）。編集後は isEdited = true、元の本文を originalContent に保存する
  async function savePostEdit(post: ProfilePost) {
    if (!editPostContent.trim()) return;
    setSavingPostEdit(true);
    setPostError("");
    try {
      const ttlPatch = post.isProtected
        ? {}
        : { ttl: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60 };

      await client.models.Post.update({
        id: post.id,
        content: editPostContent.trim(),
        originalContent: post.content,
        isEdited: true,
        ...ttlPatch,
      });

      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? {
              ...p,
              content: editPostContent.trim(),
              originalContent: post.content,
              isEdited: true,
              ...ttlPatch,
            }
            : p
        )
      );
      setEditingPostId(null);
      setEditPostContent("");
    } catch {
      setPostError("投稿の編集に失敗しました");
    } finally {
      setSavingPostEdit(false);
    }
  }

  const fetchFavorites = useCallback(async () => {
    if (!profile) return;
    setFavoritesLoading(true);
    try {
      const { data: reactions } = await client.models.UserReaction.listUserReactionByUserId({
        userId: profile.userId,
      });
      const favoriteReactions = (reactions ?? []).filter((r) => r.type === "FAVORITE");
      setFavoritedIds(new Set(favoriteReactions.map((r) => r.postId)));

      const posts = await Promise.all(
        favoriteReactions.map(async (r) => {
          const { data: post } = await client.models.Post.get({ id: r.postId });
          return post ?? null;
        })
      );
      const validPosts = posts.filter((p): p is NonNullable<typeof p> => !!p);

      const uniqueUserIds = [...new Set(validPosts.map((p) => p.userId))];
      const userMap = new Map<string, { username: string; avatarUrl: string }>();
      await Promise.all(
        uniqueUserIds.map(async (uid) => {
          const { data: user } = await client.models.User.get({ userId: uid });
          if (user) {
            const avatarUrl = user.avatarUrl ? await getUrl({ path: user.avatarUrl }).then(({ url }) => url.toString()).catch(() => "") : "";
            userMap.set(uid, { username: user.username, avatarUrl });
          }
        })
      );

      const resolvedImages = await Promise.all(
        validPosts.map(async (post) => {
          const paths = post.imageUrls?.filter((p): p is string => !!p) ?? [];
          return Promise.all(paths.map((path) => getUrl({ path }).then(({ url }) => url.toString()).catch(() => "")));
        })
      );

      setFavoritePosts(
        validPosts
          .map((post, i) => {
            const user = userMap.get(post.userId);
            const username = user?.username ?? "Unknown";
            return {
              id: post.id,
              userId: post.userId,
              content: post.content,
              originalContent: post.originalContent,
              isEdited: post.isEdited ?? false,
              imageUrls: resolvedImages[i].filter(Boolean),
              hashtags: post.hashtags?.filter((h): h is string => !!h) ?? [],
              favoriteCount: post.favoriteCount ?? 0,
              viralCount: post.viralCount ?? 0,
              ttl: post.ttl,
              isProtected: post.isProtected ?? false,
              createdAt: post.createdAt ?? "",
              username,
              userInitial: username[0]?.toUpperCase() ?? "?",
              avatarUrl: user?.avatarUrl || undefined,
            };
          })
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      );
      setFavoritesLoaded(true);
    } catch {
      // フェッチ失敗時はリストを空にする
    } finally {
      setFavoritesLoading(false);
    }
  }, [profile]);

  const handleFavoriteToggle = useCallback(async (postId: string, currentlyFavorited: boolean) => {
    if (!profile) return;
    if (currentlyFavorited) {
      await client.models.UserReaction.delete({ userId: profile.userId, postId });
      setFavoritedIds((prev) => { const next = new Set(prev); next.delete(postId); return next; });
      setFavoritePosts((prev) => prev.filter((p) => p.id !== postId));
    } else {
      await client.models.UserReaction.create({ userId: profile.userId, postId, type: "FAVORITE" });
      setFavoritedIds((prev) => new Set(prev).add(postId));
    }
    // 投稿タブのカウントを楽観的に更新する
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, favoriteCount: Math.max(0, p.favoriteCount + (currentlyFavorited ? -1 : 1)) }
          : p
      )
    );
  }, [profile]);

  useEffect(() => {
    if (activeTab === "favorites" && !favoritesLoaded && profile) {
      fetchFavorites();
    }
  }, [activeTab, favoritesLoaded, profile, fetchFavorites]);

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
          <button
            onClick={() => router.push("/follow")}
            className="text-left hover:opacity-70 transition-opacity"
          >
            <p className="text-xl font-bold text-gray-400">
              {profile.followingCount ?? 0}
            </p>
            <p className="text-xs text-gray-500">フォロー</p>
          </button>
          <button
            onClick={() => router.push("/follower")}
            className="text-left hover:opacity-70 transition-opacity"
          >
            <p className="text-xl font-bold text-gray-400">
              {profile.followerCount ?? 0}
            </p>
            <p className="text-xs text-gray-500">フォロワー</p>
          </button>
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

      {/* プロフィール編集エラー */}
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {/* プロフィール編集アクション */}
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

      {/* 投稿/お気に入りタブ */}
      {!editing && (
        <section className="border-t border-default mt-2">
          <div className="flex border-b border-default">
            <button
              onClick={() => setActiveTab("posts")}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                activeTab === "posts"
                  ? "text-brand border-b-2 border-brand"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              投稿
            </button>
            <button
              onClick={() => setActiveTab("favorites")}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                activeTab === "favorites"
                  ? "text-brand border-b-2 border-brand"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              お気に入り
            </button>
          </div>

          {/* 投稿タブ */}
          {activeTab === "posts" && (
            <div>
              {postError && (
                <p className="text-sm text-red-600 mb-3 pt-3">{postError}</p>
              )}

              {postsLoading ? (
                <p className="text-gray-400 text-sm py-4">読み込み中...</p>
              ) : posts.length === 0 ? (
                <p className="text-gray-400 text-sm py-4">まだ投稿がありません</p>
              ) : (
                <div>
                  {posts.map((post) => (
                    <div key={post.id} className="border-b border-gray-100 py-4">
                      {editingPostId === post.id ? (
                        /* 編集フォーム */
                        <div>
                          <textarea
                            value={editPostContent}
                            onChange={(e) => setEditPostContent(e.target.value)}
                            maxLength={280}
                            rows={5}
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-gray-500 transition-colors resize-none"
                          />
                          <p className="text-xs text-gray-400 text-right mt-0.5">
                            {editPostContent.length} / 280
                          </p>
                          <div className="flex gap-3 mt-2">
                            <button
                              onClick={() => savePostEdit(post)}
                              disabled={savingPostEdit || !editPostContent.trim()}
                              className="flex-1 bg-gray-900 hover:bg-gray-700 text-white font-bold py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
                            >
                              {savingPostEdit ? "保存中..." : "保存する"}
                            </button>
                            <button
                              onClick={cancelEditPost}
                              disabled={savingPostEdit}
                              className="flex-1 border border-gray-300 text-gray-700 font-bold py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
                            >
                              キャンセル
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* 閲覧 + 管理ボタン */
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-400">
                              {post.createdAt ? formatRelativeDate(post.createdAt) : ""}
                            </span>
                            {post.isEdited && (
                              <span className="flex items-center gap-0.5 text-xs text-gray-400">
                                <HiPencil size={11} />
                                編集済み
                              </span>
                            )}
                          </div>

                          <div className="text-sm text-gray-800 whitespace-pre-wrap break-words leading-relaxed">
                            <MarkdownContent>
                              {showOriginalMap[post.id] && post.originalContent
                                ? post.originalContent
                                : post.content}
                            </MarkdownContent>
                          </div>

                          {post.isEdited && post.originalContent && (
                            <button
                              onClick={() =>
                                setShowOriginalMap((prev) => ({
                                  ...prev,
                                  [post.id]: !prev[post.id],
                                }))
                              }
                              className="mt-1 text-xs text-blue-500 hover:underline"
                            >
                              {showOriginalMap[post.id] ? "編集後を表示" : "編集前を表示"}
                            </button>
                          )}

                          {post.hashtags.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                              {post.hashtags.map((tag, i) => (
                                <span
                                  key={i}
                                  className="text-xs text-blue-500 hover:underline cursor-pointer"
                                  onClick={() => router.push(`/search?mode=hashtag&q=${encodeURIComponent(tag)}`)}
                                >
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="mt-3 flex gap-5">
                            <span className="flex items-center gap-1 text-xs text-gray-400">
                              <FaRegComment size={14} />
                            </span>
                            <button
                              onClick={() => handleFavoriteToggle(post.id, favoritedIds.has(post.id))}
                              className={`flex items-center gap-1 text-xs transition-colors ${
                                favoritedIds.has(post.id)
                                  ? "text-red-400"
                                  : "text-gray-400 hover:text-red-400"
                              }`}
                            >
                              {favoritedIds.has(post.id) ? <HiStar size={16} /> : <HiOutlineStar size={16} />}
                              {post.favoriteCount > 0 && <span>{post.favoriteCount}</span>}
                            </button>
                            <span className="flex items-center gap-1 text-xs text-gray-400">
                              <HiOutlineLightningBolt size={16} />
                              {post.viralCount > 0 && <span>{post.viralCount}</span>}
                            </span>
                          </div>

                          <div className="mt-2 flex items-center justify-between">
                            <div className="flex gap-2">
                              <button
                                onClick={() => toggleProtect(post)}
                                disabled={
                                  protectingPostId === post.id ||
                                  (!post.isProtected && (profile.protectedPostCount ?? 0) >= 5)
                                }
                                className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                  post.isProtected
                                    ? "border-blue-400 text-blue-500 hover:bg-blue-50"
                                    : "border-gray-300 text-gray-600 hover:bg-gray-50"
                                }`}
                              >
                                {post.isProtected ? (
                                  <HiLockClosed size={12} />
                                ) : (
                                  <HiLockOpen size={12} />
                                )}
                                {protectingPostId === post.id
                                  ? "..."
                                  : post.isProtected
                                    ? "保護解除"
                                    : "保護する"}
                              </button>

                              {!post.isEdited && (
                                <button
                                  onClick={() => startEditPost(post)}
                                  className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                                >
                                  <HiPencil size={12} />
                                  編集
                                </button>
                              )}
                            </div>

                            <span className="text-xs text-gray-400">
                              {post.isProtected
                                ? "保護中（自動削除されません）"
                                : post.ttl
                                  ? `削除予定: ${formatUnixTimestamp(post.ttl)}`
                                  : ""}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* お気に入りタブ */}
          {activeTab === "favorites" && (
            <div>
              {favoritesLoading ? (
                <p className="text-gray-400 text-sm py-4">読み込み中...</p>
              ) : favoritePosts.length === 0 ? (
                <p className="text-gray-400 text-sm py-4">お気に入りの投稿はありません</p>
              ) : (
                <div>
                  {favoritePosts.map((post) => (
                    <PostContent
                      key={post.id}
                      postId={post.id}
                      userId={post.userId}
                      content={post.content}
                      originalContent={post.originalContent ?? undefined}
                      isEdited={post.isEdited}
                      hashtags={post.hashtags}
                      imageUrls={post.imageUrls}
                      username={post.username}
                      userInitial={post.userInitial}
                      avatarUrl={post.avatarUrl}
                      createdAt={post.createdAt ? formatRelativeDate(post.createdAt) : undefined}
                      favoriteCount={post.favoriteCount}
                      viralCount={post.viralCount}
                      isFavorited={favoritedIds.has(post.id)}
                      onFavoriteToggle={handleFavoriteToggle}
                      onPostClick={() => router.push(`/post/${post.id}`)}
                      onAvatarClick={() => router.push(`/profile/${post.userId}`)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
