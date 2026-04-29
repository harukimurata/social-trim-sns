import { useContext } from "react";
import { ModalContext, type ModalContextType } from "@/app/providers/ModalProvider";

export function useModal(): ModalContextType {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error("useModal must be used within ModalProvider");
  return ctx;
}
