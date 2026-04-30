"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function FlowbiteInit() {
  const pathname = usePathname();

  useEffect(() => {
    import("flowbite").then(({ initFlowbite }) => {
      initFlowbite();
    });
  }, [pathname]);

  return null;
}
