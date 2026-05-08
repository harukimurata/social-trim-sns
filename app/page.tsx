"use client";

import { useState, useEffect, useCallback } from "react";
import { generateClient } from "aws-amplify/data";
import { getCurrentUser } from "aws-amplify/auth";
import { getUrl } from "aws-amplify/storage";
import { useRouter } from "next/navigation";
import type { Schema } from "@/amplify/data/resource";
import PostContent from "./components/PostContent";
import CommentModal from "./components/CommentModal";

const client = generateClient<Schema>();

type TimelinePost = {
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
  timelineAt: string;
  username: string;
  userInitial: string;
  avatarUrl?: string;
  viralByUsername?: string;
  viralByUserId?: string;
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
  const date = new Date(isoString);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "たった今";
  if (diffMins < 60) return `${diffMins}分前`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}時間前`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}日前`;
  return date.toLocaleDateString("ja-JP", {
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

export default function App() {
  const router = useRouter();
  const [posts, setPosts] = useState<TimelinePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [favoritedPostIds, setFavoritedPostIds] = useState<Set<string>>(new Set());
  const [viraledPostIds, setViraledPostIds] = useState<Set<string>>(new Set());
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentTargetPostId, setCommentTargetPostId] = useState<string | null>(null);

  const fetchTimeline = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    setFetching(true);
    setError("");
    try {
      const { userId } = await getCurrentUser();
      setCurrentUserId(userId);

      const { data: follows } = await client.models.Follow.list({
        filter: { followerId: { eq: userId } },
      });
      const followeeIds = (follows ?? []).map((f) => f.followeeId);
      const targetUserIds = [userId, ...followeeIds];

      // 自分＋フォロイーの投稿を並列フェッチ
      const postsPerUser = await Promise.all(
        targetUserIds.map(async (uid) => {
          const { data } = await client.models.Post.listPostByUserId({ userId: uid });
          return data ?? [];
        })
      );
      const rawPosts = postsPerUser.flat().sort(
        (a, b) =>
          new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
      );

      // 投稿者情報を重複なしで並列フェッチ
      const uniqueUserIds = [...new Set(rawPosts.map((p) => p.userId))];
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

      // 自分のリアクションを取得
      const { data: reactions } = await client.models.UserReaction.listUserReactionByUserId({ userId });
      const favIds = new Set(
        (reactions ?? []).filter((r) => r.type === "FAVORITE").map((r) => r.postId)
      );
      const viralIds = new Set(
        (reactions ?? []).filter((r) => r.type === "VIRAL").map((r) => r.postId)
      );
      setFavoritedPostIds(favIds);
      setViraledPostIds(viralIds);

      // コメント数・画像URLを並列解決
      const [commentCounts, resolvedImages] = await Promise.all([
        Promise.all(
          rawPosts.map(async (post) => {
            const { data } = await client.models.Comment.list({
              filter: { postId: { eq: post.id } },
            });
            return data?.length ?? 0;
          })
        ),
        Promise.all(
          rawPosts.map(async (post) => {
            const paths = post.imageUrls?.filter((p): p is string => !!p) ?? [];
            return Promise.all(paths.map(resolveS3Url));
          })
        ),
      ]);

      const regularPosts: TimelinePost[] = rawPosts.map((post, i) => {
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
          commentCount: commentCounts[i],
          ttl: post.ttl,
          isProtected: post.isProtected ?? false,
          createdAt: post.createdAt ?? "",
          timelineAt: post.createdAt ?? "",
          username,
          userInitial: username[0]?.toUpperCase() ?? "?",
          avatarUrl: user?.avatarUrl || undefined,
        };
      });

      // フォロイー（＋自分）のバイラル投稿をタイムラインに追加
      const viralEntries: TimelinePost[] = [];
      await Promise.all(
        targetUserIds.map(async (followeeId) => {
          const { data: followeeReactions } = await client.models.UserReaction.listUserReactionByUserId({
            userId: followeeId,
          });
          const viralReactions = (followeeReactions ?? []).filter((r) => r.type === "VIRAL");
          if (viralReactions.length === 0) return;

          let viralByUser = userMap.get(followeeId);
          if (!viralByUser) {
            const { data: u } = await client.models.User.get({ userId: followeeId });
            if (u) {
              const avatarUrl = u.avatarUrl ? await resolveS3Url(u.avatarUrl) : "";
              viralByUser = { username: u.username, avatarUrl };
              userMap.set(followeeId, viralByUser);
            }
          }

          await Promise.all(
            viralReactions.map(async (reaction) => {
              const { data: post } = await client.models.Post.get({ id: reaction.postId });
              if (!post) return;

              let postUser = userMap.get(post.userId);
              if (!postUser) {
                const { data: u } = await client.models.User.get({ userId: post.userId });
                if (u) {
                  const avatarUrl = u.avatarUrl ? await resolveS3Url(u.avatarUrl) : "";
                  postUser = { username: u.username, avatarUrl };
                  userMap.set(post.userId, postUser);
                }
              }

              const imagePaths = post.imageUrls?.filter((p): p is string => !!p) ?? [];
              const imageUrls = await Promise.all(imagePaths.map(resolveS3Url));

              const { data: comments } = await client.models.Comment.list({
                filter: { postId: { eq: post.id } },
              });

              const username = postUser?.username ?? "Unknown";
              viralEntries.push({
                id: post.id,
                userId: post.userId,
                content: post.content,
                originalContent: post.originalContent,
                isEdited: post.isEdited ?? false,
                imageUrls: imageUrls.filter(Boolean),
                hashtags: post.hashtags?.filter((h): h is string => !!h) ?? [],
                favoriteCount: post.favoriteCount ?? 0,
                viralCount: post.viralCount ?? 0,
                commentCount: comments?.length ?? 0,
                ttl: post.ttl,
                isProtected: post.isProtected ?? false,
                createdAt: post.createdAt ?? "",
                timelineAt: reaction.createdAt ?? post.createdAt ?? "",
                username,
                userInitial: username[0]?.toUpperCase() ?? "?",
                avatarUrl: postUser?.avatarUrl || undefined,
                viralByUsername: viralByUser?.username,
                viralByUserId: followeeId,
              });
            })
          );
        })
      );

      // 通常投稿とバイラルエントリを timelineAt で降順マージ
      const merged = [...regularPosts, ...viralEntries].sort(
        (a, b) => new Date(b.timelineAt).getTime() - new Date(a.timelineAt).getTime()
      );

      setPosts(merged);
    } catch (e) {
      console.error(e);
      setError("タイムラインの読み込みに失敗しました");
    } finally {
      setLoading(false);
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    fetchTimeline(true);
  }, [fetchTimeline]);

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
      <div className="sticky top-14 z-10 bg-white/90 backdrop-blur-sm py-2 border-b border-gray-100 -mt-4 flex justify-center">
        <button
          onClick={() => fetchTimeline()}
          disabled={fetching}
          className="w-[400px] py-2 text-sm font-semibold text-brand border border-brand rounded-full hover:bg-brand/5 disabled:opacity-50 transition-colors"
        >
          {fetching ? "更新中..." : "最新の投稿を読み込む"}
        </button>
      </div>

      {loading ? (
        <p className="px-4 py-8 text-center text-sm text-gray-400">読み込み中...</p>
      ) : error ? (
        <p className="px-4 py-8 text-center text-sm text-red-500">{error}</p>
      ) : posts.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-gray-400">
          まだ投稿がありません。最初の投稿を作成してみましょう！
        </p>
      ) : (
        <div>
          {posts.map((post) => (
            <PostContent
              key={`${post.id}${post.viralByUserId ? `_v_${post.viralByUserId}` : ""}`}
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
              viralByUsername={post.viralByUsername}
              onPostClick={() => router.push(`/post/${post.id}`)}
              onCommentClick={() => { setCommentTargetPostId(post.id); setCommentModalOpen(true); }}
              onAvatarClick={() => router.push(`/profile/${post.userId}`)}
              onFavoriteToggle={handleFavoriteToggle}
              onViralToggle={handleViralToggle}
            />
          ))}
        </div>
      )}

      <CommentModal
        isOpen={commentModalOpen}
        onClose={() => setCommentModalOpen(false)}
        postId={commentTargetPostId ?? ""}
        onSuccess={fetchTimeline}
      />
    </main>
  );
}
