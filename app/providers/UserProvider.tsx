"use client";

import { useEffect } from "react";
import { useSetAtom } from "jotai";
import { getCurrentUser } from "aws-amplify/auth";
import { getUrl } from "aws-amplify/storage";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { avatarAtom } from "@/lib/atoms/avatarAtom";

const client = generateClient<Schema>();

export function UserProvider({ children }: { children: React.ReactNode }) {
  const setAvatar = useSetAtom(avatarAtom);

  useEffect(() => {
    async function init() {
      try {
        const { userId } = await getCurrentUser();
        const { data } = await client.models.User.get({ userId });
        if (!data) return;

        const initial = data.username ? data.username[0].toUpperCase() : "?";
        let displayUrl = "";
        if (data.avatarUrl) {
          const { url } = await getUrl({ path: data.avatarUrl });
          displayUrl = url.toString();
        }
        setAvatar({ initial, displayUrl });
      } catch {
        // 未ログイン・認証エラー時は初期値のまま
      }
    }
    init();
  }, [setAvatar]);

  return <>{children}</>;
}
