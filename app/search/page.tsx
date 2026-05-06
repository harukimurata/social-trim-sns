"use client";

import { useState, useEffect, useCallback } from "react";
import { generateClient } from "aws-amplify/data";
import { getCurrentUser } from "aws-amplify/auth";
import { getUrl } from "aws-amplify/storage";
import { useRouter, useSearchParams } from "next/navigation";
import type { Schema } from "@/amplify/data/resource";
import PostContent from "@/app/components/PostContent";

const client = generateClient<Schema>();

type SearchMode = "userId" | "hashtag";

type SearchPost = {
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

async function resolveS3Url(path: string): Promise<string> {
  try {
    const { url } = await getUrl({ path });
    return url.toString();
  } catch {
    return "";
  }
}

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

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<SearchMode>(() =>
    searchParams.get("mode") === "hashtag" ? "hashtag" : "userId"
  );
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [posts, setPosts] = useState<SearchPost[]>([]);
  const [searched, setSearched] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [favoritedPostIds, setFavoritedPostIds] = useState<Set<string>>(new Set());

  function switchMode(next: SearchMode) {
    setMode(next);
    setQuery("");
    setError("");
    setPosts([]);
    setSearched(false);
    setFavoritedPostIds(new Set());
  }

  async function performSearch(searchMode: SearchMode, searchQuery: string) {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;

    setLoading(true);
    setError("");
    setPosts([]);
    setSearched(true);

    try {
      if (searchMode === "userId") {
        const seqId = parseInt(trimmed, 10);
        if (isNaN(seqId)) {
          setError("ユーザーIDは数字で入力してください");
          return;
        }
        const { data: users } = await client.models.User.listUserBySequentialUserId({
          sequentialUserId: seqId,
        });
        const user = users?.[0];
        if (!user) {
          setError("ユーザーが見つかりませんでした");
          return;
        }
        router.push(`/profile/${user.userId}`);
      } else {
        const { userId } = await getCurrentUser();
        setCurrentUserId(userId);

        const tag = trimmed.replace(/^#/, "");
        const { data: rawPosts } = await client.models.Post.list({
          filter: { hashtags: { contains: tag } },
        });

        if (!rawPosts || rawPosts.length === 0) {
          return;
        }

        const sorted = [...rawPosts].sort(
          (a, b) =>
            new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
        );

        const uniqueUserIds = [...new Set(sorted.map((p) => p.userId))];
        const userMap = new Map<string, { username: string; avatarUrl: string }>();
        await Promise.all(
          uniqueUserIds.map(async (uid) => {
            const { data } = await client.models.User.get({ userId: uid });
            if (data) {
              const avatarUrl = data.avatarUrl ? await resolveS3Url(data.avatarUrl) : "";
              userMap.set(uid, { username: data.username, avatarUrl });
            }
          })
        );

        const resolvedImages = await Promise.all(
          sorted.map(async (post) => {
            const paths = post.imageUrls?.filter((p): p is string => !!p) ?? [];
            return Promise.all(paths.map(resolveS3Url));
          })
        );

        setPosts(
          sorted.map((post, i) => {
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
        );

        // 現在ログイン中ユーザーのお気に入りを取得してSetを構築する
        const { data: reactions } = await client.models.UserReaction.listUserReactionByUserId({ userId });
        setFavoritedPostIds(
          new Set((reactions ?? []).filter((r) => r.type === "FAVORITE").map((r) => r.postId))
        );
      }
    } catch (e) {
      console.error(e);
      setError("検索に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  const handleFavoriteToggle = useCallback(async (postId: string, currentlyFavorited: boolean) => {
    if (!currentUserId) return;
    if (currentlyFavorited) {
      await client.models.UserReaction.delete({ userId: currentUserId, postId });
      setFavoritedPostIds((prev) => { const next = new Set(prev); next.delete(postId); return next; });
    } else {
      await client.models.UserReaction.create({ userId: currentUserId, postId, type: "FAVORITE" });
      setFavoritedPostIds((prev) => new Set(prev).add(postId));
    }
  }, [currentUserId]);

  // URL パラメータが変わるたびにハッシュタグ検索を実行する
  useEffect(() => {
    const m = searchParams.get("mode");
    const q = searchParams.get("q");
    if (m === "hashtag" && q) {
      setMode("hashtag");
      setQuery(q);
      performSearch("hashtag", q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function handleSearch() {
    performSearch(mode, query);
  }

  return (
    <main className="w-full max-w-[600px]">
      {/* タブ切り替え */}
      <div className="flex border-b border-gray-100">
        <button
          onClick={() => switchMode("userId")}
          className={`flex-1 py-3 text-sm font-semibold transition-colors ${
            mode === "userId"
              ? "text-brand border-b-2 border-brand"
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          ユーザーID
        </button>
        <button
          onClick={() => switchMode("hashtag")}
          className={`flex-1 py-3 text-sm font-semibold transition-colors ${
            mode === "hashtag"
              ? "text-brand border-b-2 border-brand"
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          ハッシュタグ
        </button>
      </div>

      {/* 検索入力エリア */}
      <div className="px-4 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          {mode === "hashtag" && (
            <span className="text-gray-400 text-sm font-semibold select-none">#</span>
          )}
          <input
            type={mode === "userId" ? "number" : "text"}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder={
              mode === "userId" ? "ユーザーIDを入力（数字）" : "ハッシュタグを入力"
            }
            className="flex-1 border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-brand"
          />
          <button
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            className="px-5 py-2 bg-gray-900 text-white text-sm font-semibold rounded-full hover:bg-gray-700 disabled:opacity-40 transition-colors"
          >
            {loading ? "検索中..." : "検索"}
          </button>
        </div>
      </div>

      {/* エラー表示 */}
      {error && (
        <p className="px-4 py-6 text-center text-sm text-red-500">{error}</p>
      )}

      {/* ハッシュタグ検索結果 */}
      {!error && searched && mode === "hashtag" && !loading && (
        posts.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-gray-400">投稿がありません</p>
        ) : (
          <div>
            {posts.map((post) => (
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
                deletionScheduledAt={
                  post.isProtected
                    ? null
                    : post.ttl
                      ? formatUnixTimestamp(post.ttl)
                      : undefined
                }
                isProtected={post.isProtected}
                isFavorited={favoritedPostIds.has(post.id)}
                onPostClick={() => router.push(`/post/${post.id}`)}
                onAvatarClick={() => router.push(`/profile/${post.userId}`)}
                onFavoriteToggle={handleFavoriteToggle}
              />
            ))}
          </div>
        )
      )}
    </main>
  );
}
