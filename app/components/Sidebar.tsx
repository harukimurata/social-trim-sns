"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "aws-amplify/auth";
import { useState } from "react";
import { FaRegUser, FaSearch } from "react-icons/fa";
import { HiHome } from "react-icons/hi";
import { CiBoxList } from "react-icons/ci";
import { SiBuzzfeed } from "react-icons/si";
import { IoMdNotifications } from "react-icons/io";
import { PiSignOut } from "react-icons/pi";

const iconClass = "shrink-0 w-5 h-5 transition duration-75 group-hover:text-fg-brand";

const navItems = [
  {
    href: "/profile",
    label: "プロフィール",
    icon: <FaRegUser className={iconClass} aria-hidden="true" />,
    hideOnTablet: false,
  },
  {
    href: "/",
    label: "ホーム",
    icon: <HiHome className={iconClass} aria-hidden="true" />,
    hideOnTablet: true,
  },
  {
    href: "/search",
    label: "サーチ",
    icon: <FaSearch className={iconClass} aria-hidden="true" />,
    hideOnTablet: true,
  },
  {
    href: "/buzz",
    label: "バイラリング",
    icon: <SiBuzzfeed className={iconClass} aria-hidden="true" />,
    hideOnTablet: true,
  },
  {
    href: "/notice",
    label: "お知らせ",
    icon: <IoMdNotifications className={iconClass} aria-hidden="true" />,
    hideOnTablet: true,
  },
  {
    href: "/list",
    label: "リスト",
    icon: <CiBoxList className={iconClass} aria-hidden="true" />,
    hideOnTablet: false,
  },

];

export default function Sidebar() {
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
    <aside
      id="app-sidebar"
      className="fixed top-13 left-0 z-40 w-64 h-[calc(100vh-3rem)] transition-transform -translate-x-full sm:translate-x-0"
      aria-label="サイドバー"
    >
      <div className="h-full px-3 py-4 overflow-y-auto bg-neutral-primary-soft border-e border-default flex flex-col justify-between">
        <ul className="space-y-2 font-medium">
          {navItems.map((item) => (
            <li key={item.href} className={item.hideOnTablet ? "md:block hidden" : ""}>
              <Link
                href={item.href}
                className="flex items-center px-2 py-1.5 text-body rounded-base hover:bg-neutral-tertiary hover:text-fg-brand group"
              >
                {item.icon}
                <span className="ms-3">{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
        <ul className="font-medium">
          <li>
            <button
              onClick={handleSignOut}
              disabled={loading}
              className="flex items-center w-full px-2 py-1.5 text-body rounded-base hover:bg-neutral-tertiary hover:text-fg-brand group disabled:opacity-50"
            >
              <PiSignOut className={iconClass} aria-hidden="true" />
              <span className="ms-3">{loading ? "処理中..." : "サインアウト"}</span>
            </button>
          </li>
        </ul>
      </div>
    </aside>
  );
}
