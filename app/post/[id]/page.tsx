"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { generateClient } from "aws-amplify/data";
import { getUrl } from "aws-amplify/storage";
import type { Schema } from "@/amplify/data/resource";
import PostContent from "@/app/components/PostContent";
import { HiArrowLeft } from "react-icons/hi";
import { FaRegComment } from "react-icons/fa";

const client = generateClient<Schema>();

type PostDetail = {
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

type CommentItem = {
  id: string;
  postId: string;
  parentCommentId?: string | null;
  userId: string;
  content: string;
  originalContent?: string | null;
  isEdited: boolean;
  postedAt?: string | null;
  createdAt: string;
  username: string;
  userInitial: string;
  avatarUrl?: string;
  replies: CommentItem[];
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
 * ISO日時文字列を "YYYY/MM/DD HH:MM" 形式に変換する
 * @param isoString ISO 8601形式の日時文字列
 */
function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
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

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;

    async function fetchPostAndComments() {
      setLoading(true);
      setError("");
      try {
        // 投稿を取得
        const { data: rawPost } = await client.models.Post.get({ id });
        if (!rawPost) {
          setError("投稿が見つかりません");
          return;
        }

        // 投稿者情報とコメント一覧を並列フェッチ
        const [userData, commentsData] = await Promise.all([
          client.models.User.get({ userId: rawPost.userId }),
          client.models.Comment.listCommentByPostIdAndPostedAt({ postId: rawPost.id }),
        ]);

        const user = userData.data;
        const avatarUrl = user?.avatarUrl ? await resolveS3Url(user.avatarUrl) : "";
        const username = user?.username ?? "Unknown";

        // 画像URLを解決
        const imagePaths = rawPost.imageUrls?.filter((p): p is string => !!p) ?? [];
        const resolvedImages = await Promise.all(imagePaths.map(resolveS3Url));

        setPost({
          id: rawPost.id,
          userId: rawPost.userId,
          content: rawPost.content,
          originalContent: rawPost.originalContent,
          isEdited: rawPost.isEdited ?? false,
          imageUrls: resolvedImages.filter(Boolean),
          hashtags: rawPost.hashtags?.filter((h): h is string => !!h) ?? [],
          favoriteCount: rawPost.favoriteCount ?? 0,
          viralCount: rawPost.viralCount ?? 0,
          ttl: rawPost.ttl,
          isProtected: rawPost.isProtected ?? false,
          createdAt: rawPost.createdAt ?? "",
          username,
          userInitial: username[0]?.toUpperCase() ?? "?",
          avatarUrl: avatarUrl || undefined,
        });

        // コメントをトップレベルと返信に分類し、ユーザー情報を付加
        const rawComments = commentsData.data ?? [];

        const uniqueCommentUserIds = [...new Set(rawComments.map((c) => c.userId))];
        const commentUserMap = new Map<string, { username: string; avatarUrl: string }>();
        await Promise.all(
          uniqueCommentUserIds.map(async (uid) => {
            const { data } = await client.models.User.get({ userId: uid });
            if (data) {
              const url = data.avatarUrl ? await resolveS3Url(data.avatarUrl) : "";
              commentUserMap.set(uid, { username: data.username, avatarUrl: url });
            }
          })
        );

        // 返信コメントをparentCommentIdでグルーピング
        const replyMap = new Map<string, CommentItem[]>();
        for (const c of rawComments) {
          if (!c.parentCommentId) continue;
          const commentUser = commentUserMap.get(c.userId);
          const cUsername = commentUser?.username ?? "Unknown";
          const item: CommentItem = {
            id: c.id,
            postId: c.postId,
            parentCommentId: c.parentCommentId,
            userId: c.userId,
            content: c.content,
            originalContent: c.originalContent,
            isEdited: c.isEdited ?? false,
            postedAt: c.postedAt,
            createdAt: c.createdAt ?? "",
            username: cUsername,
            userInitial: cUsername[0]?.toUpperCase() ?? "?",
            avatarUrl: commentUser?.avatarUrl || undefined,
            replies: [],
          };
          const existing = replyMap.get(c.parentCommentId) ?? [];
          replyMap.set(c.parentCommentId, [...existing, item]);
        }

        // トップレベルコメントに返信を付加
        const topLevelComments: CommentItem[] = rawComments
          .filter((c) => !c.parentCommentId)
          .map((c) => {
            const commentUser = commentUserMap.get(c.userId);
            const cUsername = commentUser?.username ?? "Unknown";
            return {
              id: c.id,
              postId: c.postId,
              parentCommentId: null,
              userId: c.userId,
              content: c.content,
              originalContent: c.originalContent,
              isEdited: c.isEdited ?? false,
              postedAt: c.postedAt,
              createdAt: c.createdAt ?? "",
              username: cUsername,
              userInitial: cUsername[0]?.toUpperCase() ?? "?",
              avatarUrl: commentUser?.avatarUrl || undefined,
              replies: replyMap.get(c.id) ?? [],
            };
          });

        setComments(topLevelComments);
      } catch (e) {
        console.error(e);
        setError("投稿の読み込みに失敗しました");
      } finally {
        setLoading(false);
      }
    }

    fetchPostAndComments();
  }, [id]);

  if (loading) {
    return (
      <main className="px-4 py-6">
        <p className="text-gray-400 text-sm">読み込み中...</p>
      </main>
    );
  }

  if (error || !post) {
    return (
      <main className="px-4 py-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-4"
        >
          <HiArrowLeft size={16} />
          戻る
        </button>
        <p className="text-red-500 text-sm">{error || "投稿が見つかりません"}</p>
      </main>
    );
  }

  const totalCommentCount = comments.reduce((sum, c) => sum + 1 + c.replies.length, 0);

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

      {/* 投稿詳細 */}
      <PostContent
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
        createdAt={post.createdAt ? formatDate(post.createdAt) : undefined}
        favoriteCount={post.favoriteCount}
        viralCount={post.viralCount}
        commentCount={totalCommentCount}
        deletionScheduledAt={
          post.isProtected
            ? null
            : post.ttl
              ? formatUnixTimestamp(post.ttl)
              : undefined
        }
        isProtected={post.isProtected}
        onAvatarClick={() => router.push(`/profile/${post.userId}`)}
      />

      {/* コメントセクション */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <FaRegComment size={15} />
          <span>コメント {totalCommentCount > 0 ? `(${totalCommentCount})` : ""}</span>
        </div>
      </div>

      {comments.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-gray-400">
          まだコメントはありません
        </p>
      ) : (
        <div>
          {comments.map((comment) => (
            <div key={comment.id}>
              <CommentRow
                comment={comment}
                onAvatarClick={() => router.push(`/profile/${comment.userId}`)}
              />
              {comment.replies.map((reply) => (
                <div key={reply.id} className="pl-12">
                  <CommentRow
                    comment={reply}
                    onAvatarClick={() => router.push(`/profile/${reply.userId}`)}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

type CommentRowProps = {
  comment: CommentItem;
  onAvatarClick?: () => void;
};

/**
 * コメント1件を表示するコンポーネント
 */
function CommentRow({ comment, onAvatarClick }: CommentRowProps) {
  const [showOriginal, setShowOriginal] = useState(false);
  const displayContent =
    comment.isEdited && showOriginal && comment.originalContent
      ? comment.originalContent
      : comment.content;

  const dateStr = comment.postedAt ?? comment.createdAt;
  const formattedDate = dateStr ? formatDate(dateStr) : undefined;

  return (
    <div className="px-4 py-3 border-b border-gray-100">
      <div className="flex gap-3">
        {/* アバター */}
        <div
          className={`w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white text-xs font-semibold overflow-hidden shrink-0 ${onAvatarClick ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`}
          onClick={onAvatarClick}
        >
          {comment.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={comment.avatarUrl}
              alt={comment.username}
              className="w-full h-full object-cover"
            />
          ) : (
            comment.userInitial
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-semibold text-sm text-gray-900">{comment.username}</span>
            {formattedDate && (
              <span className="text-xs text-gray-400">{formattedDate}</span>
            )}
            {comment.isEdited && (
              <span className="text-xs text-gray-400">編集済み</span>
            )}
          </div>
          <p className="text-sm text-gray-800 whitespace-pre-wrap break-words leading-relaxed">
            {displayContent}
          </p>
          {comment.isEdited && comment.originalContent && (
            <button
              onClick={() => setShowOriginal((v) => !v)}
              className="mt-1 text-xs text-fg-brand hover:underline"
            >
              {showOriginal ? "編集後を表示" : "編集前を表示"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
