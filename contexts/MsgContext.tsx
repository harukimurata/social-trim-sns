"use client";
import { createContext, useContext, useState, useCallback, useMemo } from "react";

type MsgType = "error" | "info";

interface MsgState {
  title: string | null;
  message: string | null;
  submitText: string | null;
  type: MsgType;
}

interface MsgContextProps extends MsgState {
  showMsg: (title: string, message: string, submitText: string, type: MsgType) => void;
  hideMsg: () => void;
}

const MsgContext = createContext<MsgContextProps | undefined>(undefined);

export const MsgProvider = ({ children }: { children: React.ReactNode }) => {
  const [msgState, setMsgState] = useState<MsgState>({
    title: null,
    message: null,
    submitText: null,
    type: "error",
  });

  const showMsg = useCallback((title: string, message: string, submitText: string, type: MsgType) => {
    setMsgState({ title, message, submitText, type });
  }, []);

  const hideMsg = useCallback(() => {
    setMsgState(prev => ({ ...prev, title: null, message: null }));
  }, []);

  const contextValue = useMemo(() => ({
    ...msgState,
    showMsg,
    hideMsg,
  }), [msgState, showMsg, hideMsg]);

  return (
    <MsgContext.Provider value={contextValue}>
      {children}
    </MsgContext.Provider>
  );
};

export const useMsg = () => {
  const context = useContext(MsgContext);
  if (!context) {
    throw new Error("useMsg must be used within a MsgProvider");
  }
  return context;
};

export type { MsgType, MsgState, MsgContextProps };
