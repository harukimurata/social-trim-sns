"use client";

import { useState, useCallback } from "react";
import {
  HiOutlineStar,
  HiStar,
} from "react-icons/hi2";
import { HiOutlineLightningBolt, HiLightningBolt, HiPencil } from "react-icons/hi";
import { FaRegComment } from "react-icons/fa";

export type CommentData = {
  commentId: string;
  commentNumber?: number;
  postId: string;
  parentCommentId?: string | null;
  userId?: string;
  content: string;
  originalContent?: string | null;
  isEdited?: boolean;
  username: string;
  userInitial: string;
  avatarUrl?: string;
  createdAt?: string;
  favoriteCount?: number;
  viralCount?: number;
  replyCount?: number;
  isFavorited?: boolean;
  isViraled?: boolean;
  onBodyClick?: () => void;
  onReplyClick?: () => void;
  onAvatarClick?: () => void;
  onFavoriteToggle?: (commentId: string, currentlyFavorited: boolean) => Promise<void>;
  onViralToggle?: (commentId: string, currentlyViraled: boolean) => Promise<void>;
};

export default function CommentContent({
  commentId,
  commentNumber,
  content,
  originalContent,
  isEdited,
  username,
  userInitial,
  avatarUrl,
  createdAt,
  favoriteCount = 0,
  viralCount = 0,
  replyCount = 0,
  isFavorited = false,
  isViraled = false,
  onBodyClick,
  onReplyClick,
  onAvatarClick,
  onFavoriteToggle,
  onViralToggle,
}: CommentData) {
  const [showOriginal, setShowOriginal] = useState(false);
  const [localFavorited, setLocalFavorited] = useState(isFavorited);
  const [localFavoriteCount, setLocalFavoriteCount] = useState(favoriteCount);
  const [favoriting, setFavoriting] = useState(false);
  const [localViraled, setLocalViraled] = useState(isViraled);
  const [localViralCount, setLocalViralCount] = useState(viralCount);
  const [viraling, setViraling] = useState(false);

  const handleFavoriteClick = useCallback(async () => {
    if (!onFavoriteToggle || favoriting) return;
    setFavoriting(true);
    const prevFavorited = localFavorited;
    const prevCount = localFavoriteCount;
    setLocalFavorited(!localFavorited);
    setLocalFavoriteCount(localFavorited ? Math.max(0, localFavoriteCount - 1) : localFavoriteCount + 1);
    try {
      await onFavoriteToggle(commentId, localFavorited);
    } catch {
      setLocalFavorited(prevFavorited);
      setLocalFavoriteCount(prevCount);
    } finally {
      setFavoriting(false);
    }
  }, [onFavoriteToggle, commentId, favoriting, localFavorited, localFavoriteCount]);

  const handleViralClick = useCallback(async () => {
    if (!onViralToggle || viraling) return;
    setViraling(true);
    const prevViraled = localViraled;
    const prevCount = localViralCount;
    setLocalViraled(!localViraled);
    setLocalViralCount(localViraled ? Math.max(0, localViralCount - 1) : localViralCount + 1);
    try {
      await onViralToggle(commentId, localViraled);
    } catch {
      setLocalViraled(prevViraled);
      setLocalViralCount(prevCount);
    } finally {
      setViraling(false);
    }
  }, [onViralToggle, commentId, viraling, localViraled, localViralCount]);

  const displayContent =
    isEdited && showOriginal && originalContent ? originalContent : content;

  return (
    <div
      id={commentNumber ? `comment-${commentNumber}` : undefined}
      className={`px-4 py-3 border-b border-gray-100 ${onBodyClick ? "cursor-pointer hover:bg-gray-50 transition-colors" : ""}`}
      onClick={onBodyClick}
    >
      <div className="flex gap-3">
        {/* アバター */}
        <div
          className={`w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white text-xs font-semibold overflow-hidden shrink-0 ${onAvatarClick ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`}
          onClick={(e) => { e.stopPropagation(); onAvatarClick?.(); }}
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={username} className="w-full h-full object-cover" />
          ) : (
            userInitial
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* ユーザー名・日時・編集済みバッジ */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {commentNumber && (
              <span className="text-xs text-gray-400 font-mono shrink-0">#{commentNumber}</span>
            )}
            <span className="font-semibold text-sm text-gray-900">{username}</span>
            {createdAt && (
              <span className="text-xs text-gray-400">{createdAt}</span>
            )}
            {isEdited && (
              <span className="flex items-center gap-0.5 text-xs text-gray-400 shrink-0">
                <HiPencil size={11} />
                編集済み
              </span>
            )}
          </div>

          {/* 本文 */}
          <p className="text-sm text-gray-800 whitespace-pre-wrap break-words leading-relaxed">
            {displayContent.split(/(#\d+)/g).map((part, i) => {
              const m = /^#(\d+)$/.exec(part);
              if (m) {
                return (
                  <a
                    key={i}
                    href={`#comment-${m[1]}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-fg-brand hover:underline"
                  >
                    {part}
                  </a>
                );
              }
              return part;
            })}
          </p>

          {/* 編集前/後切り替えボタン */}
          {isEdited && originalContent && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowOriginal((v) => !v); }}
              className="mt-1 text-xs text-fg-brand hover:underline"
            >
              {showOriginal ? "編集後を表示" : "編集前を表示"}
            </button>
          )}

          {/* アクションボタン */}
          <div className="mt-2 flex gap-5" onClick={(e) => e.stopPropagation()}>
            {onReplyClick !== undefined && (
              <button
                onClick={onReplyClick}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-brand transition-colors"
              >
                <FaRegComment size={13} />
                {replyCount > 0 && <span>{replyCount}</span>}
              </button>
            )}
            <button
              onClick={onFavoriteToggle ? handleFavoriteClick : undefined}
              disabled={favoriting}
              className={`flex items-center gap-1 text-xs transition-colors disabled:opacity-50 ${
                localFavorited ? "text-red-400" : "text-gray-400 hover:text-red-400"
              } ${onFavoriteToggle ? "cursor-pointer" : "cursor-default"}`}
            >
              {localFavorited ? <HiStar size={15} /> : <HiOutlineStar size={15} />}
              {localFavoriteCount > 0 && <span>{localFavoriteCount}</span>}
            </button>
            <button
              onClick={onViralToggle ? handleViralClick : undefined}
              disabled={viraling}
              className={`flex items-center gap-1 text-xs transition-colors disabled:opacity-50 ${
                localViraled ? "text-green-500" : "text-gray-400 hover:text-green-500"
              } ${onViralToggle ? "cursor-pointer" : "cursor-default"}`}
            >
              {localViraled ? <HiLightningBolt size={15} /> : <HiOutlineLightningBolt size={15} />}
              {localViralCount > 0 && <span>{localViralCount}</span>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
