"use client";

import { useState, useEffect, useCallback } from "react";
import { generateClient } from "aws-amplify/data";
import { getCurrentUser } from "aws-amplify/auth";
import { getUrl } from "aws-amplify/storage";
import { useRouter } from "next/navigation";
import type { Schema } from "@/amplify/data/resource";
import PostContent from "@/app/components/PostContent";
import CommentModal from "@/app/components/CommentModal";

const client = generateClient<Schema>();

type Tab = "hashtag" | "viral";

type HashtagRank = {
  rank: number;
  hashtag: string;
  count: number;
};

type ViralPost = {
  id: string;
  userId: string;
  content: string;
  originalContent?: string | null;
  isEdited: boolean;
  imageUrls: string[];
  hashtags: string[];
  favoriteCount: number;
  viralCount: number;
  commentCount: number;
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

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

export default function ViralingPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("hashtag");

  const [hashtagRanks, setHashtagRanks] = useState<HashtagRank[]>([]);
  const [hashtagLoading, setHashtagLoading] = useState(false);

  const [viralPosts, setViralPosts] = useState<ViralPost[]>([]);
  const [viralLoading, setViralLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [favoritedPostIds, setFavoritedPostIds] = useState<Set<string>>(new Set());
  const [viraledPostIds, setViraledPostIds] = useState<Set<string>>(new Set());
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentTargetPostId, setCommentTargetPostId] = useState<string | null>(null);

  useEffect(() => {
    if (tab === "hashtag" && hashtagRanks.length === 0) {
      fetchHashtagTrend();
    } else if (tab === "viral" && viralPosts.length === 0) {
      fetchViralPosts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function fetchHashtagTrend() {
    setHashtagLoading(true);
    try {
      const now = new Date();
      const todayKey = toDateKey(now);
      const yesterdayKey = toDateKey(new Date(now.getTime() - 86400000));

      const { data } = await client.models.HashtagDailyCount.list({
        filter: {
          or: [
            { dateKey: { eq: todayKey } },
            { dateKey: { eq: yesterdayKey } },
          ],
        },
      });

      const countMap = new Map<string, number>();
      for (const item of data ?? []) {
        countMap.set(item.hashtag, (countMap.get(item.hashtag) ?? 0) + (item.count ?? 0));
      }

      setHashtagRanks(
        [...countMap.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([hashtag, count], i) => ({ rank: i + 1, hashtag, count }))
      );
    } finally {
      setHashtagLoading(false);
    }
  }

  async function fetchViralPosts() {
    setViralLoading(true);
    try {
      const { userId } = await getCurrentUser();
      setCurrentUserId(userId);

      const { data: rankings } = await client.models.ViralRanking.list({
        filter: { rankingType: { eq: "VIRAL" } },
      });

      if (!rankings || rankings.length === 0) {
        setViralPosts([]);
        return;
      }

      const sorted = [...rankings].sort((a, b) => a.rank - b.rank);

      const rawPosts = await Promise.all(
        sorted.map(async (ranking) => {
          const { data } = await client.models.Post.get({ id: ranking.postId });
          return data ?? null;
        })
      );
      const validPosts = rawPosts.filter((p): p is NonNullable<typeof p> => p !== null);

      const uniqueUserIds = [...new Set(validPosts.map((p) => p.userId))];
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
        validPosts.map(async (post) => {
          const paths = post.imageUrls?.filter((p): p is string => !!p) ?? [];
          return Promise.all(paths.map(resolveS3Url));
        })
      );

      setViralPosts(
        validPosts.map((post, i) => {
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
            commentCount: post.commentCount ?? 0,
            ttl: post.ttl,
            isProtected: post.isProtected ?? false,
            createdAt: post.createdAt ?? "",
            username,
            userInitial: username[0]?.toUpperCase() ?? "?",
            avatarUrl: user?.avatarUrl || undefined,
          };
        })
      );

      const { data: reactions } = await client.models.UserReaction.listUserReactionByUserId({ userId });
      setFavoritedPostIds(
        new Set((reactions ?? []).filter((r) => r.type === "FAVORITE").map((r) => r.postId))
      );
      setViraledPostIds(
        new Set((reactions ?? []).filter((r) => r.type === "VIRAL").map((r) => r.postId))
      );
    } finally {
      setViralLoading(false);
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

  const handleViralToggle = useCallback(async (postId: string, currentlyViraled: boolean) => {
    if (!currentUserId) return;
    if (currentlyViraled) {
      await client.models.UserReaction.delete({ userId: currentUserId, postId });
      setViraledPostIds((prev) => { const next = new Set(prev); next.delete(postId); return next; });
    } else {
      await client.models.UserReaction.create({ userId: currentUserId, postId, type: "VIRAL" });
      setViraledPostIds((prev) => new Set(prev).add(postId));
    }
  }, [currentUserId]);

  return (
    <main className="w-full max-w-[600px]">
      {/* タブ切り替え */}
      <div className="flex border-b border-gray-100">
        <button
          onClick={() => setTab("hashtag")}
          className={`flex-1 py-3 text-sm font-semibold transition-colors ${
            tab === "hashtag"
              ? "text-brand border-b-2 border-brand"
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          ハッシュタグランキング
        </button>
        <button
          onClick={() => setTab("viral")}
          className={`flex-1 py-3 text-sm font-semibold transition-colors ${
            tab === "viral"
              ? "text-brand border-b-2 border-brand"
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          バイラル投稿
        </button>
      </div>

      {/* ハッシュタグランキング */}
      {tab === "hashtag" && (
        <>
          {hashtagLoading && (
            <p className="px-4 py-8 text-center text-sm text-gray-400">読み込み中...</p>
          )}
          {!hashtagLoading && hashtagRanks.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-gray-400">トレンドデータがありません</p>
          )}
          {!hashtagLoading && hashtagRanks.length > 0 && (
            <div>
              {hashtagRanks.map((item) => (
                <button
                  key={item.hashtag}
                  onClick={() =>
                    router.push(`/search?mode=hashtag&q=${encodeURIComponent(item.hashtag)}`)
                  }
                  className="w-full flex items-center gap-4 px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors text-left"
                >
                  <span className="w-8 text-center text-sm font-bold text-gray-400">
                    {item.rank}
                  </span>
                  <span className="flex-1 text-sm font-semibold text-gray-900">
                    #{item.hashtag}
                  </span>
                  <span className="text-xs text-gray-400">
                    {item.count.toLocaleString()}件
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* バイラル投稿一覧 */}
      {tab === "viral" && (
        <>
          {viralLoading && (
            <p className="px-4 py-8 text-center text-sm text-gray-400">読み込み中...</p>
          )}
          {!viralLoading && viralPosts.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-gray-400">バイラル投稿がありません</p>
          )}
          {!viralLoading && viralPosts.length > 0 && (
            <div>
              {viralPosts.map((post) => (
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
                  commentCount={post.commentCount}
                  deletionScheduledAt={
                    post.isProtected
                      ? null
                      : post.ttl
                        ? formatUnixTimestamp(post.ttl)
                        : undefined
                  }
                  isProtected={post.isProtected}
                  isFavorited={favoritedPostIds.has(post.id)}
                  isViraled={viraledPostIds.has(post.id)}
                  onPostClick={() => router.push(`/post/${post.id}`)}
                  onCommentClick={
                    currentUserId
                      ? () => { setCommentTargetPostId(post.id); setCommentModalOpen(true); }
                      : undefined
                  }
                  onAvatarClick={() => router.push(`/profile/${post.userId}`)}
                  onFavoriteToggle={handleFavoriteToggle}
                  onViralToggle={handleViralToggle}
                />
              ))}
            </div>
          )}
        </>
      )}

      <CommentModal
        isOpen={commentModalOpen}
        onClose={() => setCommentModalOpen(false)}
        postId={commentTargetPostId ?? ""}
      />
    </main>
  );
}
