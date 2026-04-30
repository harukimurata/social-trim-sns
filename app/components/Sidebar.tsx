import Link from "next/link";
import { HiHome } from "react-icons/hi";
import { CiSearch, CiBoxList } from "react-icons/ci";
import { SiBuzzfeed } from "react-icons/si";

const iconClass = "shrink-0 w-5 h-5 transition duration-75 group-hover:text-fg-brand";

const navItems = [
  {
    href: "/",
    label: "ホーム",
    icon: <HiHome className={iconClass} aria-hidden="true" />,
  },
  {
    href: "/search",
    label: "サーチ",
    icon: <CiSearch className={iconClass} aria-hidden="true" />,
  },
  {
    href: "/Buzz",
    label: "バイラリング",
    icon: <SiBuzzfeed className={iconClass} aria-hidden="true" />,
  },
  {
    href: "/list",
    label: "リスト",
    icon: <CiBoxList className={iconClass} aria-hidden="true" />,
  },
];

export default function Sidebar() {
  return (
    <aside
      id="app-sidebar"
      className="fixed top-0 left-0 z-40 w-64 h-full pt-14 transition-transform -translate-x-full sm:translate-x-0"
      aria-label="サイドバー"
    >
      <div className="h-full px-3 py-4 overflow-y-auto bg-neutral-primary-soft border-e border-default">
        <ul className="space-y-2 font-medium">
          {navItems.map((item) => (
            <li key={item.href}>
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
      </div>
    </aside>
  );
}
