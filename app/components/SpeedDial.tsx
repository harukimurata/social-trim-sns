"use client";

import { useState } from "react";
import PostModal from "./PostModal";

export default function SpeedDial() {
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsPostModalOpen(true)}
        aria-label="新しい投稿"
        className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-40 flex items-center justify-center w-14 h-14 text-white bg-brand rounded-full shadow-lg hover:bg-brand-strong focus:ring-4 focus:ring-brand-medium focus:outline-none transition-colors"
      >
        <svg
          className="w-6 h-6"
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M5 12h14m-7 7V5"
          />
        </svg>
      </button>

      <PostModal
        isOpen={isPostModalOpen}
        onClose={() => setIsPostModalOpen(false)}
      />
    </>
  );
}
