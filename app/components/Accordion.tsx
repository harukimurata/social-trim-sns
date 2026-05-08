"use client";

import { useState } from "react";

type AccordionItem = {
  id: string;
  title: string;
  content: React.ReactNode;
};

export function Accordion({ items }: { items: AccordionItem[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="rounded-base border border-default overflow-hidden shadow-xs">
      {items.map((item, index) => {
        const isOpen = openId === item.id;
        const isLast = index === items.length - 1;
        return (
          <div key={item.id} className={isLast && !isOpen ? "" : "border-b border-default"}>
            <button
              type="button"
              className="flex items-center justify-between w-full px-4 py-3 font-medium text-left text-body hover:text-heading hover:bg-neutral-secondary-medium gap-3"
              onClick={() => setOpenId(isOpen ? null : item.id)}
              aria-expanded={isOpen}
            >
              <span className="text-sm">{item.title}</span>
              <svg
                className={`w-4 h-4 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
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
                  d="m5 15 7-7 7 7"
                />
              </svg>
            </button>
            {isOpen && (
              <div className="px-4 py-3 border-t border-default">
                {item.content}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
