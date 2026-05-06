"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import MarkdownContent from "./MarkdownContent";
import {
  HiOutlineStar,
  HiChevronLeft,
  HiChevronRight,
} from "react-icons/hi2";
import { HiOutlineLightningBolt, HiPencil } from "react-icons/hi";
import { FaRegComment } from "react-icons/fa";
import { IoClose } from "react-icons/io5";

export type PostData = {
  postId?: string;
  userId?: string;
  content: string;
  originalContent?: string;
  isEdited?: boolean;
  hashtags: string[];
  imageUrls: string[];
  username: string;
  userInitial: string;
  avatarUrl?: string;
  createdAt?: string;
  favoriteCount?: number;
  viralCount?: number;
  commentCount?: number;
  /** null = 保護中（削除されない）、string = 削除予定日時、undefined = 非表示 */
  deletionScheduledAt?: string | null;
  isProtected?: boolean;
  onPostClick?: () => void;
  onAvatarClick?: () => void;
};

export default function PostContent({
  content,
  originalContent,
  isEdited,
  hashtags,
  imageUrls,
  username,
  userInitial,
  avatarUrl,
  createdAt,
  favoriteCount = 0,
  viralCount = 0,
  commentCount = 0,
  deletionScheduledAt,
  onPostClick,
  onAvatarClick,
}: PostData) {
  const router = useRouter();
  const [currentImage, setCurrentImage] = useState(0);
  const [zoomedIndex, setZoomedIndex] = useState<number | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);

  const handleHashtagClick = useCallback(
    (tag: string) => router.push(`/search?mode=hashtag&q=${encodeURIComponent(tag)}`),
    [router]
  );

  const displayContent =
    isEdited && showOriginal && originalContent ? originalContent : content;
  const filledHashtags = hashtags.filter((t) => t.trim() !== "");

  const goPrev = () => setCurrentImage((c) => Math.max(0, c - 1));
  const goNext = () =>
    setCurrentImage((c) => Math.min(imageUrls.length - 1, c + 1));

  const zoomPrev = () =>
    setZoomedIndex((c) => (c !== null ? Math.max(0, c - 1) : null));
  const zoomNext = () =>
    setZoomedIndex((c) =>
      c !== null ? Math.min(imageUrls.length - 1, c + 1) : null
    );

  useEffect(() => {
    if (zoomedIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoomedIndex(null);
      if (e.key === "ArrowLeft") zoomPrev();
      if (e.key === "ArrowRight") zoomNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomedIndex, imageUrls.length]);

  return (
    <div
      className={`px-4 py-4 border-gray-100 ${onPostClick ? "cursor-pointer hover:bg-gray-50 transition-colors" : ""}`}
      onClick={onPostClick}
    >
      <div className="flex gap-3">
        {/* アバター（クリックでプロフィールへ） */}
        <div
          className={`w-10 h-10 rounded-full bg-brand-500 flex items-center justify-center text-white text-sm font-semibold overflow-hidden shrink-0 ${onAvatarClick ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`}
          onClick={(e) => { e.stopPropagation(); onAvatarClick?.(); }}
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={username}
              className="w-full h-full object-cover"
            />
          ) : (
            userInitial
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* ユーザー名・日時・編集済みバッジ */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-semibold text-sm text-gray-900 truncate">
              {username}
            </span>
            {createdAt && (
              <span className="text-xs text-gray-400 shrink-0">{createdAt}</span>
            )}
            {isEdited && (
              <span className="flex items-center gap-0.5 text-xs text-gray-400 shrink-0">
                <HiPencil size={11} />
                編集済み
              </span>
            )}
          </div>

          {/* 本文（編集前/後で切り替え） */}
          <div className="text-sm text-gray-800 break-words leading-relaxed">
            <MarkdownContent>{displayContent}</MarkdownContent>
          </div>

          {/* 編集前/後 切り替えボタン */}
          {isEdited && originalContent && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowOriginal((v) => !v); }}
              className="mt-1 text-xs text-fg-brand hover:underline"
            >
              {showOriginal ? "編集後を表示" : "編集前を表示"}
            </button>
          )}

          {/* 画像カルーセル */}
          {imageUrls.length > 0 && (
            <div
              className="mt-3 relative rounded-xl overflow-hidden bg-gray-100 select-none"
              onClick={(e) => e.stopPropagation()}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrls[currentImage]}
                alt={`画像 ${currentImage + 1}`}
                className="w-full max-h-72 object-cover cursor-zoom-in"
                onClick={() => setZoomedIndex(currentImage)}
              />

              {imageUrls.length > 1 && (
                <>
                  {/* 枚数カウンター */}
                  <span className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full pointer-events-none">
                    {currentImage + 1} / {imageUrls.length}
                  </span>

                  {/* ドットインジケーター */}
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {imageUrls.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentImage(i)}
                        className={`w-1.5 h-1.5 rounded-full transition-colors ${i === currentImage ? "bg-white" : "bg-white/50"
                          }`}
                        aria-label={`画像 ${i + 1} へ移動`}
                      />
                    ))}
                  </div>

                  {/* 前へ */}
                  {currentImage > 0 && (
                    <button
                      onClick={goPrev}
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center transition-colors"
                      aria-label="前の画像"
                    >
                      <HiChevronLeft size={18} />
                    </button>
                  )}

                  {/* 次へ */}
                  {currentImage < imageUrls.length - 1 && (
                    <button
                      onClick={goNext}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center transition-colors"
                      aria-label="次の画像"
                    >
                      <HiChevronRight size={18} />
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* ハッシュタグ */}
          {filledHashtags.length > 0 && (
            <div
              className="mt-2 flex flex-wrap gap-x-3 gap-y-1"
              onClick={(e) => e.stopPropagation()}
            >
              {filledHashtags.map((tag, i) => (
                <span
                  key={i}
                  className="text-xs text-fg-brand hover:underline cursor-pointer"
                  onClick={() => handleHashtagClick(tag)}
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* アクションボタン */}
          <div className="mt-3 flex gap-5" onClick={(e) => e.stopPropagation()}>
            <button className="flex items-center gap-1 text-xs text-gray-400 hover:text-brand transition-colors">
              <FaRegComment size={14} />
              {commentCount > 0 && <span>{commentCount}</span>}
            </button>
            <button className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-400 transition-colors">
              <HiOutlineStar size={16} />
              {favoriteCount > 0 && <span>{favoriteCount}</span>}
            </button>
            <button className="flex items-center gap-1 text-xs text-gray-400 hover:text-green-500 transition-colors">
              <HiOutlineLightningBolt size={16} />
              {viralCount > 0 && <span>{viralCount}</span>}
            </button>

          </div>

          {/* 削除予定日時 / 保護ステータス */}
          {deletionScheduledAt !== undefined && (
            <p className="mt-2 text-xs text-right text-gray-400">
              {deletionScheduledAt === null
                ? "保護中（自動削除されません）"
                : `削除予定: ${deletionScheduledAt}`}
            </p>
          )}
        </div>
      </div>

      {/* 拡大表示オーバーレイ */}
      {zoomedIndex !== null && (
        <div
          className="fixed inset-0 z-[60] bg-black flex items-center justify-center"
          onClick={(e) => { e.stopPropagation(); setZoomedIndex(null); }}
        >
          {/* 閉じるボタン（左上） */}
          <button
            onClick={(e) => { e.stopPropagation(); setZoomedIndex(null); }}
            className="absolute top-4 left-4 z-10 bg-black/60 hover:bg-black/80 text-white rounded-full w-9 h-9 flex items-center justify-center transition-colors"
            aria-label="閉じる"
          >
            <IoClose size={20} />
          </button>

          {/* 枚数カウンター（右上） */}
          {imageUrls.length > 1 && (
            <span className="absolute top-4 right-4 z-10 bg-black/60 text-white text-xs px-2 py-1 rounded-full pointer-events-none">
              {zoomedIndex + 1} / {imageUrls.length}
            </span>
          )}

          {/* 拡大画像 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrls[zoomedIndex]}
            alt={`画像 ${zoomedIndex + 1}`}
            className="max-w-full max-h-full object-contain cursor-zoom-out"
            onClick={(e) => e.stopPropagation()}
          />

          {/* 前へ */}
          {zoomedIndex > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); zoomPrev(); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full w-10 h-10 flex items-center justify-center transition-colors"
              aria-label="前の画像"
            >
              <HiChevronLeft size={22} />
            </button>
          )}

          {/* 次へ */}
          {zoomedIndex < imageUrls.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); zoomNext(); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full w-10 h-10 flex items-center justify-center transition-colors"
              aria-label="次の画像"
            >
              <HiChevronRight size={22} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
