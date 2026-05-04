"use client";

import { useState, useEffect, useCallback } from "react";
import { generateClient } from "aws-amplify/data";
import { getCurrentUser } from "aws-amplify/auth";
import { getUrl } from "aws-amplify/storage";
import { useRouter } from "next/navigation";
import type { Schema } from "@/amplify/data/resource";
import PostContent from "./components/PostContent";

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
  username: string;
  userInitial: string;
  avatarUrl?: string;
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
 * @returns "N分前" / "N時間前" / "N日前" / "YYYY/MM/DD"
 */
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

export default function App() {
  const router = useRouter();
  const [posts, setPosts] = useState<TimelinePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState("");

  /**
   * タイムラインを取得する（自分 + フォロー中ユーザーの投稿を新着順で返す）
   * @param isInitial 初回ロード時はtrue（ローディング表示を切り替える）
   */
  const fetchTimeline = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    setFetching(true);
    setError("");
    try {
      const { userId } = await getCurrentUser();

      // フォロー中のユーザーIDを取得
      const { data: follows } = await client.models.Follow.list({
        filter: { followerId: { eq: userId } },
      });
      const followeeIds = (follows ?? []).map((f) => f.followeeId);
      const targetUserIds = [userId, ...followeeIds];

      // 各ユーザーの投稿を並列フェッチして結合・新着順にソート
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

      // ユーザー情報を重複なしで並列フェッチ
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

      // コメント数・画像URLを並列解決
      const [commentCounts, resolvedImages] = await Promise.all([
        Promise.all(
          rawPosts.map(async (post) => {
            const { data } = await client.models.Comment.listCommentByPostIdAndPostedAt({
              postId: post.id,
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

      const timeline: TimelinePost[] = rawPosts.map((post, i) => {
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
          username,
          userInitial: username[0]?.toUpperCase() ?? "?",
          avatarUrl: user?.avatarUrl || undefined,
        };
      });

      setPosts(timeline);
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

  return (
    <main className="w-full max-w-[600px]">
      {/* 任意のタイミングでリストを更新するフェッチボタン */}
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
              onPostClick={() => router.push(`/post/${post.id}`)}
              onAvatarClick={() => router.push(`/profile/${post.userId}`)}
            />
          ))}
        </div>
      )}
    </main>
  );
}
