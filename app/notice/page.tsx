"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "aws-amplify/auth";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { HiOutlineStar } from "react-icons/hi2";

const client = generateClient<Schema>();

type NotificationItem = {
  id: string;
  senderId: string;
  type: string;
  postId: string;
  isRead: boolean;
  createdAt: string;
  senderName: string;
};

function formatRelativeDate(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "たった今";
  if (diffMins < 60) return `${diffMins}分前`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}時間前`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}日前`;
  return new Date(isoString).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export default function NoticePage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchNotifications() {
      setLoading(true);
      setError("");
      try {
        const { userId } = await getCurrentUser();

        const { data: rawNotifs } =
          await client.models.Notification.listNotificationByRecipientId({ recipientId: userId });

        const sorted = (rawNotifs ?? []).sort(
          (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
        );

        // 送信者ユーザー名を重複なしで並列取得する
        const uniqueSenderIds = [...new Set(sorted.map((n) => n.senderId))];
        const senderMap = new Map<string, string>();
        await Promise.all(
          uniqueSenderIds.map(async (sid) => {
            const { data: user } = await client.models.User.get({ userId: sid });
            senderMap.set(sid, user?.username ?? "不明なユーザー");
          })
        );

        const items: NotificationItem[] = sorted.map((n) => ({
          id: n.id,
          senderId: n.senderId,
          type: n.type,
          postId: n.postId,
          isRead: n.isRead ?? false,
          createdAt: n.createdAt ?? "",
          senderName: senderMap.get(n.senderId) ?? "不明なユーザー",
        }));

        setNotifications(items);

        // 未読通知を既読にする
        const unread = items.filter((n) => !n.isRead);
        await Promise.all(
          unread.map((n) => client.models.Notification.update({ id: n.id, isRead: true }))
        );
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      } catch (e) {
        console.error(e);
        setError("通知の読み込みに失敗しました");
      } finally {
        setLoading(false);
      }
    }

    fetchNotifications();
  }, []);

  return (
    <main className="w-full max-w-[600px]">
      <div className="px-4 py-4 border-b border-gray-100">
        <h1 className="text-lg font-bold text-heading">お知らせ</h1>
      </div>

      {loading ? (
        <p className="px-4 py-8 text-center text-sm text-gray-400">読み込み中...</p>
      ) : error ? (
        <p className="px-4 py-8 text-center text-sm text-red-500">{error}</p>
      ) : notifications.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-gray-400">通知はありません</p>
      ) : (
        <div>
          {notifications.map((notif) => (
            <button
              key={notif.id}
              onClick={() => router.push(`/post/${notif.postId}`)}
              className={`w-full text-left px-4 py-4 border-b border-gray-100 hover:bg-gray-50 transition-colors flex items-start gap-3 ${
                !notif.isRead ? "bg-blue-50/40" : ""
              }`}
            >
              <div className="mt-0.5 text-red-400 shrink-0">
                <HiOutlineStar size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 break-words">
                  <span className="font-semibold">{notif.senderName}</span>
                  {notif.type === "FAVORITE" && " さんがあなたの投稿をお気に入りしました"}
                </p>
                {notif.createdAt && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatRelativeDate(notif.createdAt)}
                  </p>
                )}
              </div>
              {!notif.isRead && (
                <span className="mt-1.5 w-2 h-2 rounded-full bg-blue-500 shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </main>
  );
}
