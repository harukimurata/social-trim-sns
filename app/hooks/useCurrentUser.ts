import { useEffect, useState } from "react";
import { getCurrentUser, fetchAuthSession } from "aws-amplify/auth";

interface User {
  username: string;
  email: string;
}

// マウント時に1回だけ実行される。長時間同一ページに留まる場面では
// fetchAuthSession({ forceRefresh: true }) によるリフレッシュを別途実装すること。
export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { username } = await getCurrentUser();
        const session = await fetchAuthSession();
        const payload = session.tokens?.idToken?.payload;
        const email = (payload?.email as string | undefined) ?? "";
        setUser({ username, email });
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return { user, loading };
}
