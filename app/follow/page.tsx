"use client";

import { Suspense, useState, useEffect } from "react";
import { getCurrentUser } from "aws-amplify/auth";
import { generateClient } from "aws-amplify/data";
import { getUrl } from "aws-amplify/storage";
import type { Schema } from "@/amplify/data/resource";
import { useRouter, useSearchParams } from "next/navigation";
import { HiArrowLeft } from "react-icons/hi";
import ProfileCell, { type ProfileCellData } from "@/app/components/Profile";

const client = generateClient<Schema>();

/**
 * S3パスを署名付きURLに変換する
 * @param path S3オブジェクトパス
 * @returns 署名付きURL文字列（失敗時は空文字）
 */
async function resolveS3Url(path: string): Promise<string> {
    try {
        const { url } = await getUrl({ path });
        return url.toString();
    } catch {
        return "";
    }
}

function FollowList() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const targetUserId = searchParams.get("userId");

    const [users, setUsers] = useState<ProfileCellData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [pageTitle, setPageTitle] = useState("フォロー中");

    useEffect(() => {
        async function fetchFollowing() {
            try {
                let userId: string;
                if (targetUserId) {
                    userId = targetUserId;
                    // 他ユーザー閲覧時はタイトルにユーザー名を表示する
                    const userData = await client.models.User.get({ userId });
                    if (userData.data?.username) {
                        setPageTitle(`${userData.data.username}のフォロー中`);
                    }
                } else {
                    const current = await getCurrentUser();
                    userId = current.userId;
                }

                const { data: follows } = await client.models.Follow.list({
                    filter: { followerId: { eq: userId } },
                });

                if (!follows || follows.length === 0) return;

                const userResults = await Promise.all(
                    follows.map((f) => client.models.User.get({ userId: f.followeeId }))
                );

                const resolvedUsers: (ProfileCellData | null)[] = await Promise.all(
                    userResults.map(async (result): Promise<ProfileCellData | null> => {
                        const user = result.data;
                        if (!user) return null;
                        const avatarUrl = user.avatarUrl
                            ? (await resolveS3Url(user.avatarUrl)) || undefined
                            : undefined;
                        return {
                            userId: user.userId,
                            username: user.username,
                            bio: user.bio,
                            avatarUrl,
                        };
                    })
                );

                setUsers(resolvedUsers.filter((u): u is ProfileCellData => u !== null));
            } catch {
                setError("フォロー一覧の取得に失敗しました");
            } finally {
                setLoading(false);
            }
        }

        fetchFollowing();
    }, [targetUserId]);

    return (
        <main>
            <div className="px-4 py-3 border-b border-default">
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors"
                >
                    <HiArrowLeft size={16} />
                    戻る
                </button>
                <h1 className="text-lg font-bold text-heading mt-2">{pageTitle}</h1>
            </div>

            {loading ? (
                <p className="px-4 py-6 text-sm text-gray-400">読み込み中...</p>
            ) : error ? (
                <p className="px-4 py-6 text-sm text-red-500">{error}</p>
            ) : users.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-gray-400">
                    フォロー中のユーザーがいません
                </p>
            ) : (
                <div>
                    {users.map((user) => (
                        <ProfileCell key={user.userId} {...user} />
                    ))}
                </div>
            )}
        </main>
    );
}

export default function FollowPage() {
    return (
        <Suspense fallback={<p className="px-4 py-6 text-sm text-gray-400">読み込み中...</p>}>
            <FollowList />
        </Suspense>
    );
}
