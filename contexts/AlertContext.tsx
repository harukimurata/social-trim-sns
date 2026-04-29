"use client";
import { createContext, useContext, useState } from "react";

type AlertStatus = "info" | "success" | "warning" | "error";

type AlertPosition =
  | "top"
  | "bottom"
  | "topLeft"
  | "topRight"
  | "bottomLeft"
  | "bottomRight";

interface AlertContextProps {
  visible: boolean;
  status: AlertStatus;
  message: string;
  isAutoClose: boolean;
  autoCloseDuration: number;
  position: AlertPosition;
  showAlert: (
    status: AlertStatus,
    message: string,
    isAutoClose?: boolean,
    autoCloseDuration?: number,
    position?: AlertPosition,
  ) => void;
  hideAlert: () => void;
}

const AlertContext = createContext<AlertContextProps | undefined>(undefined);

export const AlertProvider = ({ children }: { children: React.ReactNode }) => {
  const [visible, setVisible] = useState<boolean>(false);
  const [status, setStatus] = useState<AlertStatus>("info");
  const [message, setMessage] = useState<string>("");
  const [isAutoClose, setIsAutoClose] = useState<boolean>(true);
  const [autoCloseDuration, setAutoCloseDuration] = useState<number>(4000);
  const [position, setPosition] = useState<AlertPosition>("top");

  const showAlert = (
    status: AlertStatus,
    message: string,
    isAutoClose = true,
    autoCloseDuration = 4000,
    position: AlertPosition = "top",
  ) => {
    setStatus(status);
    setMessage(message);
    setIsAutoClose(isAutoClose);
    setAutoCloseDuration(autoCloseDuration);
    setPosition(position);
    setVisible(true);
  };

  const hideAlert = () => {
    setVisible(false);
  };

  return (
    <AlertContext.Provider
      value={{
        visible,
        status,
        message,
        isAutoClose,
        autoCloseDuration,
        position,
        showAlert,
        hideAlert,
      }}
    >
      {children}
    </AlertContext.Provider>
  );
};

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error("invalid alert context");
  }
  return context;
};
