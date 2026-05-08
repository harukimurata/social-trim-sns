"use client";

import { useState, useRef, useEffect } from "react";
import { IoClose } from "react-icons/io5";
import { useAtomValue } from "jotai";
import { avatarAtom } from "@/lib/atoms/avatarAtom";
import { generateClient } from "aws-amplify/data";
import { getCurrentUser } from "aws-amplify/auth";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>();

const MAX_CHARS = 500;

type Props = {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
  parentCommentId?: string | null;
  replyToUsername?: string;
  replyToContent?: string;
  initialContent?: string;
  onSuccess?: () => void;
};

export default function CommentModal({
  isOpen,
  onClose,
  postId,
  parentCommentId,
  replyToUsername,
  replyToContent,
  initialContent,
  onSuccess,
}: Props) {
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { initial, displayUrl } = useAtomValue(avatarAtom);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      const prefill = initialContent ?? "";
      setContent(prefill);
      setTimeout(() => {
        textareaRef.current?.focus();
        textareaRef.current?.setSelectionRange(prefill.length, prefill.length);
      }, 50);
    } else {
      document.body.style.overflow = "";
      setContent("");
      setError("");
    }
    return () => {
      document.body.style.overflow = "";
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!content.trim() || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const { userId } = await getCurrentUser();
      const { errors } = await client.models.Comment.create({
        postId,
        parentCommentId: parentCommentId ?? null,
        userId,
        content: content.trim(),
        postedAt: new Date().toISOString(),
      });
      if (errors && errors.length > 0) throw new Error(errors[0].message);
      setContent("");
      onClose();
      onSuccess?.();
    } catch {
      setError("コメントの投稿に失敗しました。もう一度お試しください。");
    } finally {
      setSubmitting(false);
    }
  };

  const title = parentCommentId ? "返信する" : "コメントする";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[80dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-700 rounded-full"
            aria-label="閉じる"
          >
            <IoClose size={22} />
          </button>
          <h2 className="text-sm font-bold text-gray-900">{title}</h2>
          <button
            onClick={handleSubmit}
            disabled={!content.trim() || submitting}
            className="bg-brand text-white text-sm font-semibold px-4 py-1.5 rounded-full disabled:opacity-40 hover:bg-brand-strong transition-colors"
          >
            {submitting ? "投稿中..." : "投稿"}
          </button>
        </div>

        {/* 返信先スニペット */}
        {replyToUsername && replyToContent && (
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 shrink-0">
            <p className="text-xs text-gray-400 mb-0.5">{replyToUsername} への返信</p>
            <p className="text-xs text-gray-500 line-clamp-2 break-words">{replyToContent}</p>
          </div>
        )}

        {/* 入力エリア */}
        <div className="flex gap-3 px-4 py-4 flex-1 min-h-0">
          {/* アバター */}
          <div className="w-9 h-9 rounded-full bg-brand-500 flex items-center justify-center text-white text-sm font-semibold overflow-hidden shrink-0">
            {displayUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={displayUrl} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              initial
            )}
          </div>

          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={MAX_CHARS}
            placeholder={parentCommentId ? "返信を入力..." : "コメントを入力..."}
            className="flex-1 resize-none text-gray-800 placeholder:text-gray-400 text-sm leading-relaxed focus:outline-none"
            rows={4}
          />
        </div>

        {/* フッター */}
        <div className="flex items-center justify-end px-4 py-2 border-t border-gray-100 shrink-0">
          {error && <p className="text-xs text-red-500 mr-auto">{error}</p>}
          <span className="text-xs text-gray-400">
            {content.length} / {MAX_CHARS}
          </span>
        </div>
      </div>
    </div>
  );
}
