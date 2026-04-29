"use client";

import { useEffect, useState } from "react";
import { debugState } from "./debugState";

type Snapshot = typeof debugState;

function boolColor(val: boolean | null) {
  if (val === null) return "text-gray-300";
  return val ? "text-green-400" : "text-red-400";
}

export default function DebugOverlay() {
  const [snap, setSnap] = useState<Snapshot>({ ...debugState });

  useEffect(() => {
    const id = setInterval(() => setSnap({ ...debugState }), 300);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="fixed top-2 left-2 z-[9999] text-[10px] font-mono text-white bg-black/70 rounded px-2 py-1.5 space-y-0.5 pointer-events-none">
      <div className={boolColor(snap.isAuthenticated)}>
        authed: {String(snap.isAuthenticated)}
      </div>
      <div className={snap.currentRoute !== null ? "text-yellow-300" : "text-gray-300"}>
        route: {String(snap.currentRoute)}
      </div>
    </div>
  );
}
