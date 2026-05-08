"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { generateClient } from "aws-amplify/data";
import { getCurrentUser } from "aws-amplify/auth";
import { getUrl } from "aws-amplify/storage";
import type { Schema } from "@/amplify/data/resource";
import PostContent from "@/app/components/PostContent";
import CommentContent from "@/app/components/CommentContent";
import CommentModal from "@/app/components/CommentModal";
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
  commentCount: number;
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
  createdAt: string;
  username: string;
  userInitial: string;
  avatarUrl?: string;
  favoriteCount: number;
  viralCount: number;
  commentNumber: number;
  isFavorited: boolean;
  isViraled: boolean;
};

async function resolveS3Url(path: string): Promise<string> {
  try {
    const { url } = await getUrl({ path });
    return url.toString();
  } catch {
    return "";
  }
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
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

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isFavorited, setIsFavorited] = useState(false);
  const [isViraled, setIsViraled] = useState(false);
  const [replyTarget, setReplyTarget] = useState<{
    parentCommentId: string | null;
    replyToUsername?: string;
    replyToContent?: string;
    initialContent?: string;
  } | null>(null);

  const fetchPostAndComments = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const [{ userId: loginUserId }, { data: rawPost }] = await Promise.all([
        getCurrentUser(),
        client.models.Post.get({ id }),
      ]);
      setCurrentUserId(loginUserId);

      if (!rawPost) {
        setError("投稿が見つかりません");
        return;
      }

      const [userData, commentsData, reactionData, myCommentReactionsData] = await Promise.all([
        client.models.User.get({ userId: rawPost.userId }),
        client.models.Comment.list({ filter: { postId: { eq: rawPost.id } } }),
        client.models.UserReaction.get({ userId: loginUserId, postId: rawPost.id }),
        client.models.CommentReaction.listCommentReactionByUserId({ userId: loginUserId }),
      ]);

      setIsFavorited(!!reactionData.data && reactionData.data.type === "FAVORITE");
      setIsViraled(!!reactionData.data && reactionData.data.type === "VIRAL");

      const myCommentReactions = myCommentReactionsData.data ?? [];
      const favoritedCommentIds = new Set(
        myCommentReactions.filter((r) => r.type === "FAVORITE").map((r) => r.commentId)
      );
      const viraledCommentIds = new Set(
        myCommentReactions.filter((r) => r.type === "VIRAL").map((r) => r.commentId)
      );

      const user = userData.data;
      const avatarUrl = user?.avatarUrl ? await resolveS3Url(user.avatarUrl) : "";
      const username = user?.username ?? "Unknown";

      const imagePaths = rawPost.imageUrls?.filter((p): p is string => !!p) ?? [];
      const resolvedImages = await Promise.all(imagePaths.map(resolveS3Url));

      const rawComments = (commentsData.data ?? []).sort(
        (a, b) =>
          new Date(a.postedAt ?? a.createdAt ?? 0).getTime() -
          new Date(b.postedAt ?? b.createdAt ?? 0).getTime()
      );

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

      const allComments: CommentItem[] = rawComments.map((c, index) => {
        const u = commentUserMap.get(c.userId);
        const uname = u?.username ?? "Unknown";
        return {
          id: c.id,
          postId: c.postId,
          parentCommentId: c.parentCommentId,
          userId: c.userId,
          content: c.content,
          originalContent: c.originalContent,
          isEdited: c.isEdited ?? false,
          createdAt: c.postedAt ?? c.createdAt ?? "",
          username: uname,
          userInitial: uname[0]?.toUpperCase() ?? "?",
          avatarUrl: u?.avatarUrl || undefined,
          favoriteCount: c.favoriteCount ?? 0,
          viralCount: c.viralCount ?? 0,
          commentNumber: index + 1,
          isFavorited: favoritedCommentIds.has(c.id),
          isViraled: viraledCommentIds.has(c.id),
        };
      });

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
        commentCount: rawPost.commentCount ?? rawComments.length,
        ttl: rawPost.ttl,
        isProtected: rawPost.isProtected ?? false,
        createdAt: rawPost.createdAt ?? "",
        username,
        userInitial: username[0]?.toUpperCase() ?? "?",
        avatarUrl: avatarUrl || undefined,
      });

      setComments(allComments);
    } catch (e) {
      console.error(e);
      setError("投稿の読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPostAndComments();
  }, [fetchPostAndComments]);

  async function handleFavoriteToggle(postId: string, currentlyFavorited: boolean) {
    if (!currentUserId) return;
    if (currentlyFavorited) {
      await client.models.UserReaction.delete({ userId: currentUserId, postId });
      setIsFavorited(false);
    } else {
      await client.models.UserReaction.create({ userId: currentUserId, postId, type: "FAVORITE" });
      setIsFavorited(true);
    }
  }

  async function handleViralToggle(postId: string, currentlyViraled: boolean) {
    if (!currentUserId) return;
    if (currentlyViraled) {
      await client.models.UserReaction.delete({ userId: currentUserId, postId });
      setIsViraled(false);
    } else {
      await client.models.UserReaction.create({ userId: currentUserId, postId, type: "VIRAL" });
      setIsViraled(true);
    }
  }

  async function handleCommentFavoriteToggle(commentId: string, currentlyFavorited: boolean) {
    if (!currentUserId) return;
    if (currentlyFavorited) {
      await client.models.CommentReaction.delete({ userId: currentUserId, commentId });
    } else {
      await client.models.CommentReaction.create({ userId: currentUserId, commentId, type: "FAVORITE" });
    }
  }

  async function handleCommentViralToggle(commentId: string, currentlyViraled: boolean) {
    if (!currentUserId) return;
    if (currentlyViraled) {
      await client.models.CommentReaction.delete({ userId: currentUserId, commentId });
    } else {
      await client.models.CommentReaction.create({ userId: currentUserId, commentId, type: "VIRAL" });
    }
  }

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
        commentCount={post.commentCount}
        deletionScheduledAt={
          post.isProtected
            ? null
            : post.ttl
              ? formatUnixTimestamp(post.ttl)
              : undefined
        }
        isProtected={post.isProtected}
        isFavorited={isFavorited}
        isViraled={isViraled}
        onFavoriteToggle={currentUserId ? handleFavoriteToggle : undefined}
        onViralToggle={currentUserId ? handleViralToggle : undefined}
        onCommentClick={currentUserId ? () => setReplyTarget({ parentCommentId: null }) : undefined}
        onAvatarClick={() => router.push(`/profile/${post.userId}`)}
      />

      {/* コメントセクション */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <FaRegComment size={15} />
          <span>コメント {comments.length > 0 ? `(${comments.length})` : ""}</span>
        </div>
      </div>

      {comments.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-gray-400">
          まだコメントはありません
        </p>
      ) : (
        <div>
          {comments.map((comment) => (
            <CommentContent
              key={comment.id}
              commentId={comment.id}
              commentNumber={comment.commentNumber}
              postId={comment.postId}
              parentCommentId={comment.parentCommentId}
              userId={comment.userId}
              content={comment.content}
              originalContent={comment.originalContent}
              isEdited={comment.isEdited}
              username={comment.username}
              userInitial={comment.userInitial}
              avatarUrl={comment.avatarUrl}
              createdAt={comment.createdAt ? formatDate(comment.createdAt) : undefined}
              favoriteCount={comment.favoriteCount}
              viralCount={comment.viralCount}
              isFavorited={comment.isFavorited}
              isViraled={comment.isViraled}
              onReplyClick={
                currentUserId
                  ? () =>
                      setReplyTarget({
                        parentCommentId: comment.id,
                        replyToUsername: comment.username,
                        replyToContent: comment.content,
                        initialContent: `#${comment.commentNumber} `,
                      })
                  : undefined
              }
              onAvatarClick={() => router.push(`/profile/${comment.userId}`)}
              onFavoriteToggle={currentUserId ? handleCommentFavoriteToggle : undefined}
              onViralToggle={currentUserId ? handleCommentViralToggle : undefined}
            />
          ))}
        </div>
      )}

      {/* コメント投稿モーダル */}
      {currentUserId && (
        <CommentModal
          isOpen={replyTarget !== null}
          onClose={() => setReplyTarget(null)}
          postId={post.id}
          parentCommentId={replyTarget?.parentCommentId}
          replyToUsername={replyTarget?.replyToUsername}
          replyToContent={replyTarget?.replyToContent}
          initialContent={replyTarget?.initialContent}
          onSuccess={fetchPostAndComments}
        />
      )}
    </main>
  );
}
