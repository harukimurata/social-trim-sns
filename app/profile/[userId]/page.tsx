"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { getCurrentUser } from "aws-amplify/auth";
import { generateClient } from "aws-amplify/data";
import { getUrl } from "aws-amplify/storage";
import type { Schema } from "@/amplify/data/resource";
import PostContent from "@/app/components/PostContent";
import { HiArrowLeft } from "react-icons/hi";

const client = generateClient<Schema>();

type UserProfile = {
  userId: string;
  sequentialUserId?: number | null;
  username: string;
  bio?: string | null;
  avatarUrl?: string;
  totalPostCount?: number | null;
  followingCount?: number | null;
  followerCount?: number | null;
  birthdate?: string | null;
  mainUrl?: string | null;
  mainArea?: string | null;
};

type ProfilePost = {
  id: string;
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
};

/**
 * S3パスを署名付きURLに変換する
 * @param path S3オブジェクトパス
 * @returns 署名付きURL文字列（失敗時は空文字）
 */
async function resolveS3Url(path: string): Promise<string> {
  try {
    const { url } = await getUrl({ path });
    return url.toString();
  } catch {
    return "";
  }
}

/**
 * ISO日時文字列を相対表示に変換する
 * @param isoString ISO 8601形式の日時文字列
 */
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

/**
 * UnixタイムスタンプをYYYY/MM/DD HH:MM形式に変換する
 * @param unix Unix timestamp（秒）
 */
function formatUnixTimestamp(unix: number): string {
  return new Date(unix * 1000).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function UserProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<ProfilePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // フォロー関連
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followError, setFollowError] = useState("");

  // タブ・お気に入り関連
  const [activeTab, setActiveTab] = useState<"posts" | "favorites">("posts");
  const [favoritePosts, setFavoritePosts] = useState<ProfilePost[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);
  // 現在ログイン中ユーザーがお気に入りしている投稿ID（両タブの isFavorited 用）
  const [currentUserFavIds, setCurrentUserFavIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) return;

    async function fetchProfile() {
      setLoading(true);
      setError("");
      try {
        // 現在のログインユーザー情報とプロフィールユーザー情報・投稿を並列フェッチ
        const currentUser = await getCurrentUser();
        const [userData, postsData] = await Promise.all([
          client.models.User.get({ userId }),
          client.models.Post.listPostByUserId({ userId }),
        ]);

        setCurrentUserId(currentUser.userId);

        const user = userData.data;
        if (!user) {
          setError("ユーザーが見つかりません");
          return;
        }

        const avatarUrl = user.avatarUrl ? await resolveS3Url(user.avatarUrl) : "";

        setProfile({
          userId: user.userId,
          sequentialUserId: user.sequentialUserId,
          username: user.username,
          bio: user.bio,
          avatarUrl: avatarUrl || undefined,
          totalPostCount: user.totalPostCount,
          followingCount: user.followingCount,
          followerCount: user.followerCount,
          birthdate: user.birthdate,
          mainUrl: user.mainUrl,
          mainArea: user.mainArea,
        });

        // 自分のプロフィール以外のときのみフォロー状態を確認する
        if (currentUser.userId !== userId) {
          const followRecord = await client.models.Follow.get({
            followerId: currentUser.userId,
            followeeId: userId,
          });
          setIsFollowing(!!followRecord.data);
        }

        // 現在ログイン中ユーザーのお気に入りIDを取得する
        const { data: myReactions } = await client.models.UserReaction.listUserReactionByUserId({
          userId: currentUser.userId,
        });
        setCurrentUserFavIds(
          new Set((myReactions ?? []).filter((r) => r.type === "FAVORITE").map((r) => r.postId))
        );

        // 投稿の画像URLを並列解決して新着順にソート
        const rawPosts = (postsData.data ?? []).sort(
          (a, b) =>
            new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
        );
        const resolvedImages = await Promise.all(
          rawPosts.map(async (post) => {
            const paths = post.imageUrls?.filter((p): p is string => !!p) ?? [];
            return Promise.all(paths.map(resolveS3Url));
          })
        );

        setPosts(
          rawPosts.map((post, i) => ({
            id: post.id,
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
          }))
        );
      } catch (e) {
        console.error(e);
        setError("プロフィールの読み込みに失敗しました");
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [userId]);

  const fetchFavorites = useCallback(async () => {
    if (!userId) return;
    setFavoritesLoading(true);
    try {
      // プロフィールユーザーのお気に入りリアクションを取得する
      const { data: reactions } = await client.models.UserReaction.listUserReactionByUserId({ userId });
      const favoriteReactions = (reactions ?? []).filter((r) => r.type === "FAVORITE");

      const rawPosts = await Promise.all(
        favoriteReactions.map(async (r) => {
          const { data: post } = await client.models.Post.get({ id: r.postId });
          return post ?? null;
        })
      );
      const validPosts = rawPosts
        .filter((p): p is NonNullable<typeof p> => !!p)
        .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());

      const resolvedImages = await Promise.all(
        validPosts.map(async (post) => {
          const paths = post.imageUrls?.filter((p): p is string => !!p) ?? [];
          return Promise.all(paths.map(resolveS3Url));
        })
      );

      setFavoritePosts(
        validPosts.map((post, i) => ({
          id: post.id,
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
        }))
      );
      setFavoritesLoaded(true);
    } catch {
      // フェッチ失敗時はリストを空にする
    } finally {
      setFavoritesLoading(false);
    }
  }, [userId]);

  const handleFavoriteToggle = useCallback(async (postId: string, currentlyFavorited: boolean) => {
    if (!currentUserId) return;
    if (currentlyFavorited) {
      await client.models.UserReaction.delete({ userId: currentUserId, postId });
      setCurrentUserFavIds((prev) => { const next = new Set(prev); next.delete(postId); return next; });
    } else {
      await client.models.UserReaction.create({ userId: currentUserId, postId, type: "FAVORITE" });
      setCurrentUserFavIds((prev) => new Set(prev).add(postId));
    }
  }, [currentUserId]);

  useEffect(() => {
    if (activeTab === "favorites" && !favoritesLoaded) {
      fetchFavorites();
    }
  }, [activeTab, favoritesLoaded, fetchFavorites]);

  async function handleFollowToggle() {
    if (!currentUserId || !profile || currentUserId === profile.userId) return;
    setFollowLoading(true);
    setFollowError("");
    try {
      if (isFollowing) {
        await client.models.Follow.delete({
          followerId: currentUserId,
          followeeId: profile.userId,
        });
        // followerCount の DB 更新は DynamoDB Streams → Lambda が
        // TransactWriteItems でアトミックに処理するため、ここでは楽観的UI更新のみ行う
        setProfile((prev) =>
          prev ? { ...prev, followerCount: Math.max(0, (prev.followerCount ?? 1) - 1) } : prev
        );
        setIsFollowing(false);
      } else {
        await client.models.Follow.create({
          followerId: currentUserId,
          followeeId: profile.userId,
        });
        // followerCount の DB 更新は DynamoDB Streams → Lambda が
        // TransactWriteItems でアトミックに処理するため、ここでは楽観的UI更新のみ行う
        setProfile((prev) =>
          prev ? { ...prev, followerCount: (prev.followerCount ?? 0) + 1 } : prev
        );
        setIsFollowing(true);
      }
    } catch {
      setFollowError("フォロー操作に失敗しました");
    } finally {
      setFollowLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="px-4 py-6">
        <p className="text-gray-400 text-sm">読み込み中...</p>
      </main>
    );
  }

  if (error || !profile) {
    return (
      <main className="px-4 py-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-4"
        >
          <HiArrowLeft size={16} />
          戻る
        </button>
        <p className="text-red-500 text-sm">{error || "ユーザーが見つかりません"}</p>
      </main>
    );
  }

  const avatarInitial = profile.username[0]?.toUpperCase() ?? "?";
  const isSelf = currentUserId === profile.userId;

  return (
    <main>
      {/* 戻るボタン */}
      <div className="px-4 py-3 border-b border-gray-100">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <HiArrowLeft size={16} />
          戻る
        </button>
      </div>

      {/* プロフィールヘッダー */}
      <div className="px-4 py-6 border-b border-gray-100">
        {/* アバター + ユーザー名 + フォローボタン */}
        <div className="flex items-center gap-4 mb-4">
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
          <div className="flex-1 min-w-0">
            {profile.sequentialUserId != null && (
              <p className="text-xs text-gray-400 mb-0.5">ID: {profile.sequentialUserId}</p>
            )}
            <p className="text-lg font-bold text-gray-800">{profile.username}</p>
            {profile.bio && (
              <p className="text-sm text-gray-500 mt-1 whitespace-pre-wrap">{profile.bio}</p>
            )}
          </div>
          {/* 他ユーザーのみフォローボタンを表示 */}
          {!isSelf && currentUserId && (
            <div className="shrink-0">
              <button
                onClick={handleFollowToggle}
                disabled={followLoading}
                className={`px-4 py-2 text-sm font-bold rounded-full transition-colors disabled:opacity-50 ${
                  isFollowing
                    ? "border border-gray-400 text-gray-700 hover:border-red-400 hover:text-red-500"
                    : "bg-gray-900 text-white hover:bg-gray-700"
                }`}
              >
                {followLoading ? "..." : isFollowing ? "フォロー解除" : "フォロー"}
              </button>
            </div>
          )}
        </div>

        {followError && <p className="text-xs text-red-500 mb-3">{followError}</p>}

        {/* 追加情報 */}
        {(profile.birthdate || profile.mainUrl || profile.mainArea) && (
          <div className="space-y-1 mb-4 text-sm text-gray-600">
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

        {/* 統計 */}
        <div className="flex gap-8 pt-3 border-t border-default">
          <button
            onClick={() => router.push(`/follow?userId=${profile.userId}`)}
            className="text-left hover:opacity-70 transition-opacity"
          >
            <p className="text-xl font-bold text-gray-400">{profile.followingCount ?? 0}</p>
            <p className="text-xs text-gray-500">フォロー</p>
          </button>
          <button
            onClick={() => router.push(`/follower?userId=${profile.userId}`)}
            className="text-left hover:opacity-70 transition-opacity"
          >
            <p className="text-xl font-bold text-gray-400">{profile.followerCount ?? 0}</p>
            <p className="text-xs text-gray-500">フォロワー</p>
          </button>
          <div>
            <p className="text-xl font-bold text-gray-400">{profile.totalPostCount ?? 0}</p>
            <p className="text-xs text-gray-500">累計投稿数</p>
          </div>
        </div>
      </div>

      {/* 投稿/お気に入りタブ */}
      <div className="flex border-b border-gray-100">
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
        posts.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-gray-400">まだ投稿がありません</p>
        ) : (
          <div>
            {posts.map((post) => (
              <PostContent
                key={post.id}
                postId={post.id}
                userId={profile.userId}
                content={post.content}
                originalContent={post.originalContent ?? undefined}
                isEdited={post.isEdited}
                hashtags={post.hashtags}
                imageUrls={post.imageUrls}
                username={profile.username}
                userInitial={avatarInitial}
                avatarUrl={profile.avatarUrl}
                createdAt={post.createdAt ? formatRelativeDate(post.createdAt) : undefined}
                favoriteCount={post.favoriteCount}
                viralCount={post.viralCount}
                isFavorited={currentUserFavIds.has(post.id)}
                onFavoriteToggle={currentUserId && !isSelf ? handleFavoriteToggle : undefined}
                deletionScheduledAt={
                  post.isProtected
                    ? null
                    : post.ttl
                      ? formatUnixTimestamp(post.ttl)
                      : undefined
                }
                isProtected={post.isProtected}
                onPostClick={() => router.push(`/post/${post.id}`)}
                onAvatarClick={() => router.push(`/profile/${profile.userId}`)}
              />
            ))}
          </div>
        )
      )}

      {/* お気に入りタブ */}
      {activeTab === "favorites" && (
        favoritesLoading ? (
          <p className="px-4 py-8 text-center text-sm text-gray-400">読み込み中...</p>
        ) : favoritePosts.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-gray-400">お気に入りの投稿はありません</p>
        ) : (
          <div>
            {favoritePosts.map((post) => (
              <PostContent
                key={post.id}
                postId={post.id}
                userId={post.id}
                content={post.content}
                originalContent={post.originalContent ?? undefined}
                isEdited={post.isEdited}
                hashtags={post.hashtags}
                imageUrls={post.imageUrls}
                username={profile.username}
                userInitial={avatarInitial}
                avatarUrl={profile.avatarUrl}
                createdAt={post.createdAt ? formatRelativeDate(post.createdAt) : undefined}
                favoriteCount={post.favoriteCount}
                viralCount={post.viralCount}
                isFavorited={currentUserFavIds.has(post.id)}
                onFavoriteToggle={currentUserId ? handleFavoriteToggle : undefined}
                onPostClick={() => router.push(`/post/${post.id}`)}
                onAvatarClick={() => router.push(`/profile/${profile.userId}`)}
              />
            ))}
          </div>
        )
      )}
    </main>
  );
}
