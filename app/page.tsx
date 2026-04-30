"use client";

import { useState, useEffect } from "react";
import { generateClient } from "aws-amplify/data";
import { getCurrentUser } from "aws-amplify/auth";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>();

export default function App() {
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUser() {
      try {
        const { userId } = await getCurrentUser();
        const { data } = await client.models.User.get({ userId });
        setUsername(data?.username ?? null);
      } catch {
        setUsername(null);
      } finally {
        setLoading(false);
      }
    }
    fetchUser();
  }, []);

  return (
    <main className="px-4 py-6">
      {loading ? (
        <p className="text-gray-400 text-sm">読み込み中...</p>
      ) : username ? (
        <p className="text-gray-400 font-semibold">こんにちは、{username} さん</p>
      ) : (
        <p className="text-gray-400 text-sm">ユーザー情報を取得できませんでした</p>
      )}
    </main>
  );
}
