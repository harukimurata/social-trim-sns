"use client";

import { useRouter } from "next/navigation";
import { signOut } from "aws-amplify/auth";
import { useState } from "react";

export default function Navbar() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    try {
      await signOut();
      router.push("/signIn");
    } finally {
      setLoading(false);
    }
  }

  return (
    <nav className="fixed top-0 z-50 w-full bg-neutral-primary-soft border-b border-default">
      <div className="px-3 py-3 lg:px-5 lg:pl-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center justify-start rtl:justify-end">
            <button
              data-drawer-target="app-sidebar"
              data-drawer-toggle="app-sidebar"
              aria-controls="app-sidebar"
              type="button"
              className="sm:hidden text-heading bg-transparent box-border border border-transparent hover:bg-neutral-secondary-medium focus:ring-4 focus:ring-neutral-tertiary font-medium leading-5 rounded-base text-sm p-2 focus:outline-none"
            >
              <span className="sr-only">サイドバーを開く</span>
              <svg
                className="w-6 h-6"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="2"
                  d="M5 7h14M5 12h14M5 17h10"
                />
              </svg>
            </button>
            <a href="/" className="flex ms-2 md:me-24">
              <span className="self-center text-lg font-semibold whitespace-nowrap text-heading">
                trim
              </span>
            </a>
          </div>
          <div className="flex items-center">
            <div className="flex items-center ms-3">
              <button
                type="button"
                className="flex text-sm rounded-full focus:ring-4 focus:ring-neutral-tertiary"
                aria-expanded="false"
                data-dropdown-toggle="dropdown-user"
              >
                <span className="sr-only">ユーザーメニューを開く</span>
                <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white text-sm font-semibold">
                  T
                </div>
              </button>
              <div
                className="z-50 hidden bg-neutral-primary-medium border border-default-medium rounded-base shadow-lg w-44"
                id="dropdown-user"
              >
                <ul className="p-2 text-sm text-body font-medium" role="none">
                  <li>
                    <button
                      onClick={handleSignOut}
                      disabled={loading}
                      className="inline-flex items-center w-full p-2 hover:bg-neutral-tertiary-medium hover:text-heading rounded disabled:opacity-50"
                      role="menuitem"
                    >
                      {loading ? "処理中..." : "サインアウト"}
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
