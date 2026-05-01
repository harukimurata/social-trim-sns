import type { Metadata } from "next";
import "./index.css";
import { ConfigureAmplifyClientSide } from "./components/ConfigureAmplifyClientSide";
import FlowbiteInit from "./components/FlowbiteInit";
import MsgModal from "./components/MsgModal";
import Alert from "./components/Alert";
import AppShell from "./components/AppShell";
import { MsgProvider } from "@/contexts/MsgContext";
import { AlertProvider } from "@/contexts/AlertContext";
import { ModalProvider } from "./providers/ModalProvider";
import DebugOverlay from "./components/debug/DebugOverlay";

export const metadata: Metadata = {
  title: {
    template: "%s | trim",
    default: "trim",
  },
  description: "シンプルに、きりとる。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        <ModalProvider>
          <AlertProvider>
            <MsgProvider>
              <AppShell>{children}</AppShell>
              <Alert />
              <MsgModal />
            </MsgProvider>
          </AlertProvider>
        </ModalProvider>
        {process.env.NEXT_PUBLIC_APP_ENV === "dev" && <DebugOverlay />}
      </body>
      <ConfigureAmplifyClientSide />
      <FlowbiteInit />
    </html>
  );
}
