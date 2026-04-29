"use client";
import { useMsg } from "@/contexts/MsgContext";
import { useEffect } from "react";

const MsgModal = () => {
  const { title, message, submitText, type, hideMsg } = useMsg();

  useEffect(() => {
    if (message) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [message]);

  if (!message) return null;

  if (type === "error") {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-800 bg-opacity-5 px-2 z-50">
        <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
          <h2 className="text-xl font-bold text-red-600">{title}</h2>
          <p className="mt-4 text-gray-700">{message}</p>
          <button
            className="mt-6 bg-red-600 text-white px-4 py-2 rounded-lg"
            onClick={hideMsg}
          >
            {submitText}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50 px-2 z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
        <h2 className="text-xl font-bold text-blue-600">{title}</h2>
        <p className="mt-4 text-gray-700">{message}</p>
        <button
          className="mt-6 bg-blue-600 text-white px-4 py-2 rounded-lg"
          onClick={hideMsg}
        >
          {submitText}
        </button>
      </div>
    </div>
  );
};

export default MsgModal;
