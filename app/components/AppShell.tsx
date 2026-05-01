"use client";

import { usePathname } from "next/navigation";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";

const AUTH_PATHS = ["/signIn", "/signUp", "/resetPassword"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = AUTH_PATHS.some((p) => pathname.startsWith(p));

  if (isAuthPage) {
    return <div className="phone-container bg-white">{children}</div>;
  }

  return (
    <>
      <Navbar />
      <div className="relative">
        <Sidebar />
        <div className="p-4 sm:ml-64 mt-14 pb-20 sm:pb-4">{children}</div>
      </div>
      <BottomNav />
    </>
  );
}
