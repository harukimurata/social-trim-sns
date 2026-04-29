"use client";

import { createContext, useState, type ReactNode } from "react";

type ModalEntry = {
  title: string;
  content: ReactNode;
};

export type ModalContextType = {
  openModal: (entry: ModalEntry) => void;
  closeModal: () => void;
};

export const ModalContext = createContext<ModalContextType | null>(null);

function ModalShell({
  title,
  onClose,
  zIndex,
  children,
}: {
  title: string;
  onClose: () => void;
  zIndex: number;
  children: ReactNode;
}) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center bg-black/30"
      style={{ zIndex }}
    >
      <div className="bg-white rounded-2xl w-11/12 max-w-sm shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-gray-900">
          <h2 className="text-white font-bold text-sm">{title}</h2>
          <button onClick={onClose} className="text-white text-xl">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ModalProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<ModalEntry[]>([]);

  const openModal = (entry: ModalEntry) =>
    setStack(prev => [...prev, entry]);

  const closeModal = () =>
    setStack(prev => prev.slice(0, -1));

  return (
    <ModalContext.Provider value={{ openModal, closeModal }}>
      {children}
      {stack.map((entry, i) => (
        <ModalShell
          key={i}
          title={entry.title}
          onClose={closeModal}
          zIndex={50 + i * 10}
        >
          {entry.content}
        </ModalShell>
      ))}
    </ModalContext.Provider>
  );
}
