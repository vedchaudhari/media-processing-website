"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

/**
 * Client-side route guard: redirects to /login if nobody's logged in (or to
 * "/" if `adminOnly` and the logged-in user isn't an admin). This is a UX
 * convenience only — the actual security boundary is the API's requireAuth/
 * requireAdmin middleware, which the frontend can't bypass regardless of what
 * this component does.
 */
export default function RequireAuth({
  children,
  adminOnly = false,
}: {
  children: React.ReactNode;
  adminOnly?: boolean;
}) {
  const { user, isHydrated } = useAuth();
  const router = useRouter();

  const allowed = !!user && (!adminOnly || user.role === "admin");

  useEffect(() => {
    if (!isHydrated) return;
    if (!user) {
      router.replace("/login");
    } else if (adminOnly && user.role !== "admin") {
      router.replace("/");
    }
  }, [isHydrated, user, adminOnly, router]);

  if (!isHydrated || !allowed) {
    return (
      <div className="flex flex-1 items-center justify-center p-10 text-sm text-zinc-500 dark:text-zinc-400">
        Loading…
      </div>
    );
  }

  return <>{children}</>;
}
