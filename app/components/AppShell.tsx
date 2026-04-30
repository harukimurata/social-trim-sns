"use client";

import { usePathname } from "next/navigation";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";

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
      <Sidebar />
      <div className="p-4 sm:ml-64 mt-14">{children}</div>
    </>
  );
}
