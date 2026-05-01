"use client";

export default function Navbar() {
  return (
    <nav className="fixed top-0 z-50 w-full bg-neutral-primary-soft border-b border-default">
      <div className="px-3 py-3 lg:px-5 lg:pl-3">
        <div className="flex items-center justify-start rtl:justify-end">
          <button
            data-drawer-target="app-sidebar"
            data-drawer-toggle="app-sidebar"
            aria-controls="app-sidebar"
            type="button"
            className="md:hidden flex text-sm rounded-full focus:ring-4 focus:ring-neutral-tertiary me-2"
          >
            <span className="sr-only">サイドバーを開く</span>
            <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white text-sm font-semibold">
              T
            </div>
          </button>
          <span className="flex ms-2 md:me-24 self-center text-lg font-semibold whitespace-nowrap text-heading">
            trim
          </span>
        </div>
      </div>
    </nav>
  );
}
