import type { Metadata } from "next";
import "./app.css";
import "./index.css";
import { ConfigureAmplifyClientSide } from "./components/ConfigureAmplifyClientSide";
import MsgModal from "./components/MsgModal";
import Alert from "./components/Alert";
import Header from "./components/Header";
import { MsgProvider } from "@/contexts/MsgContext";
import { AlertProvider } from "@/contexts/AlertContext";
import { ModalProvider } from "./providers/ModalProvider";
import DebugOverlay from "./components/debug/DebugOverlay";

export const metadata: Metadata = {
  title: {
    template: "%s | trim",
    default: "trim",
  },
  description: "シンプルに、きりとる。つながる。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        <div className="phone-container bg-white">
          <ModalProvider>
            <AlertProvider>
              <MsgProvider>
                <Header />
                {children}
                <Alert />
                <MsgModal />
              </MsgProvider>
            </AlertProvider>
          </ModalProvider>
          {process.env.NEXT_PUBLIC_APP_ENV === "dev" && <DebugOverlay />}
        </div>
      </body>
      <ConfigureAmplifyClientSide />
    </html>
  );
}
