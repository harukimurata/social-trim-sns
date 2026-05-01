import Link from "next/link";
import { HiHome } from "react-icons/hi";
import { FaSearch } from "react-icons/fa";
import { SiBuzzfeed } from "react-icons/si";
import { IoMdNotifications } from "react-icons/io";

const iconClass = "w-6 h-6";

const footerItems = [
  {
    href: "/",
    label: "ホーム",
    icon: <HiHome className={iconClass} aria-hidden="true" />
  },
  {
    href: "/search",
    label: "サーチ",
    icon: <FaSearch className={iconClass} aria-hidden="true" />
  },
  {
    href: "/buzz",
    label: "バイラリング",
    icon: <SiBuzzfeed className={iconClass}
      aria-hidden="true" />
  },
  {
    href: "/notice",
    label: "お知らせ",
    icon: <IoMdNotifications
      className={iconClass} aria-hidden="true" />
  },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-neutral-primary-soft border-t border-default md:hidden">
      <ul className="flex justify-around items-center h-16">
        {footerItems.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="flex flex-col items-center gap-1 px-4 py-2 text-body hover:text-fg-brand"
            >
              {item.icon}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
