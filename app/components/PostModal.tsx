"use client";

import { useState, useRef, useEffect } from "react";
import { IoClose } from "react-icons/io5";
import { FiImage } from "react-icons/fi";
import { useAtomValue } from "jotai";
import { avatarAtom } from "@/lib/atoms/avatarAtom";
import PostContent from "./PostContent";

const MAX_TEXTS = 1000;
const MAX_IMAGES = 20;
const HASHTAG_SLOTS = 4;

type Tab = "edit" | "preview";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export default function PostModal({ isOpen, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("edit");
  const [content, setContent] = useState("");
  const [hashtags, setHashtags] = useState<string[]>(
    Array(HASHTAG_SLOTS).fill("")
  );
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { initial, displayUrl } = useAtomValue(avatarAtom);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      setTimeout(() => textareaRef.current?.focus(), 50);
    } else {
      document.body.style.overflow = "";
      setTab("edit");
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const updateHashtag = (index: number, value: string) => {
    const sanitized = value.replace(/^#+/, "").replace(/\s/g, "");
    setHashtags((prev) => prev.map((h, i) => (i === index ? sanitized : h)));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const urls = files.map((f) => URL.createObjectURL(f));
    setImagePreviews((prev) => [...prev, ...urls].slice(0, MAX_IMAGES));
    e.target.value = "";
  };

  const removeImage = (index: number) => {
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    // TODO: AppSync mutation で投稿を作成する
    onClose();
    setContent("");
    setHashtags(Array(HASHTAG_SLOTS).fill(""));
    setImagePreviews([]);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="shrink-0">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={onClose}
              className="p-1 text-gray-500 hover:text-gray-700 rounded-full"
              aria-label="閉じる"
            >
              <IoClose size={22} />
            </button>
            <h2 className="text-sm font-bold text-gray-900">新しい投稿</h2>
            <button
              onClick={handleSubmit}
              disabled={!content.trim()}
              className="bg-brand text-white text-sm font-semibold px-4 py-1.5 rounded-full disabled:opacity-40 hover:bg-brand-strong transition-colors"
            >
              投稿
            </button>
          </div>

          {/* 編集 / プレビュー タブ */}
          <div className="flex border-b border-gray-100">
            {(["edit", "preview"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 text-xs font-semibold transition-colors ${tab === t
                    ? "text-brand border-b-2 border-brand"
                    : "text-gray-400 hover:text-gray-600"
                  }`}
              >
                {t === "edit" ? "編集" : "プレビュー"}
              </button>
            ))}
          </div>
        </div>

        {/* スクロール可能エリア */}
        <div className="overflow-y-auto flex-1">
          {tab === "preview" ? (
            /* ── プレビュー ── */
            content.trim() || imagePreviews.length > 0 ? (
              <PostContent
                content={content}
                hashtags={hashtags}
                imageUrls={imagePreviews}
                username="あなた"
                userInitial={initial}
                avatarUrl={displayUrl || undefined}
              />
            ) : (
              <p className="px-4 py-8 text-center text-sm text-gray-400">
                本文・画像を入力するとプレビューが表示されます
              </p>
            )
          ) : (
            /* ── 編集 ── */
            <>
              {/* 本文 */}
              <div className="px-4 pt-4 pb-2">
                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  maxLength={MAX_TEXTS}
                  placeholder="いまどうしてる？"
                  className="w-full resize-none text-gray-800 placeholder:text-gray-400 text-sm leading-relaxed focus:outline-none"
                  rows={5}
                />
              </div>

              {/* 画像サムネイル（管理用） */}
              {imagePreviews.length > 0 && (
                <div className="px-4 pb-2 flex gap-2 flex-wrap">
                  {imagePreviews.map((url, i) => (
                    <div key={i} className="relative w-20 h-20">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`添付画像 ${i + 1}`}
                        className="w-full h-full object-cover rounded-lg border border-gray-200"
                      />
                      <button
                        onClick={() => removeImage(i)}
                        className="absolute -top-1 -right-1 bg-gray-800 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                        aria-label="画像を削除"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* ハッシュタグ（4つの独立した入力欄） */}
              <div className="px-4 pb-4">
                <p className="text-xs text-gray-400 mb-2">
                  ハッシュタグ（最大4つ）
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {hashtags.map((tag, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1 border border-gray-200 rounded-lg px-2 py-1.5 focus-within:border-brand"
                    >
                      <span className="text-fg-brand text-sm font-medium select-none">
                        #
                      </span>
                      <input
                        type="text"
                        value={tag}
                        onChange={(e) => updateHashtag(i, e.target.value)}
                        placeholder={`タグ ${i + 1}`}
                        className="flex-1 text-sm text-gray-700 placeholder:text-gray-300 focus:outline-none min-w-0"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* フッターツールバー（編集タブのみ表示） */}
        {tab === "edit" && (
          <div className="flex items-center gap-3 px-4 py-3 border-t border-gray-100 shrink-0">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={imagePreviews.length >= MAX_IMAGES}
              className="text-fg-brand hover:text-brand-strong disabled:opacity-40"
              aria-label="画像を添付"
            >
              <FiImage size={20} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageChange}
              className="hidden"
            />
            {imagePreviews.length > 0 && (
              <span className="text-xs text-gray-400">
                {imagePreviews.length} / {MAX_IMAGES}
              </span>
            )}
            <span className="ml-auto text-xs text-gray-400">
              {content.length} / {MAX_TEXTS}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
