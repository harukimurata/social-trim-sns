"use client";
import { useEffect } from "react";
import {
  InformationCircleIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useAlert } from "@/contexts/AlertContext";

const Alert = () => {
  const {
    visible,
    status,
    message,
    isAutoClose,
    autoCloseDuration,
    position,
    hideAlert,
  } = useAlert();

  let colorClassName;
  let positionClassName;
  let Icon;

  useEffect(() => {
    if (visible && isAutoClose) {
      const timer = setTimeout(() => {
        hideAlert();
      }, autoCloseDuration);
      return () => clearTimeout(timer);
    }
  }, [visible, hideAlert, isAutoClose, autoCloseDuration]);

  if (!visible) return null;

  switch (status) {
    case "info":
      colorClassName = "text-blue-800 bg-blue-50 border-blue-800";
      Icon = InformationCircleIcon;
      break;
    case "success":
      colorClassName = "text-green-800 bg-green-50 border-green-800";
      Icon = CheckCircleIcon;
      break;
    case "warning":
      colorClassName = "text-yellow-800 bg-yellow-50 border-yellow-800";
      Icon = ExclamationTriangleIcon;
      break;
    case "error":
      colorClassName = "text-red-800 bg-red-50 border-red-800";
      Icon = XCircleIcon;
      break;
  }

  switch (position) {
    case "top":
      positionClassName = "top-4 left-1/2 transform -translate-x-1/2";
      break;
    case "bottom":
      positionClassName = "bottom-4 left-1/2 transform -translate-x-1/2";
      break;
    case "topLeft":
      positionClassName = "top-4 start-4";
      break;
    case "topRight":
      positionClassName = "top-4 end-4";
      break;
    case "bottomLeft":
      positionClassName = "bottom-4 start-4";
      break;
    case "bottomRight":
      positionClassName = "bottom-4 end-4";
      break;
  }

  return (
    <div
      className={`fixed ${positionClassName} z-50 p-4 mb-4 rounded-lg w-3/5 max-w-96 h-12 flex items-center text-base border ${colorClassName}`}
      role="alert"
    >
      <Icon className="w-5 h-5 mr-2" aria-hidden="true" />
      <span>{message}</span>
      <button
        className="ml-auto text-gray-600 hover:text-gray-800 focus:outline-hidden"
        onClick={hideAlert}
        aria-label="Close alert"
      >
        <XMarkIcon className="w-5 h-5" aria-hidden="true" />
      </button>
    </div>
  );
};

export default Alert;
