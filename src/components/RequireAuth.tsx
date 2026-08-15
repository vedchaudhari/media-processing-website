"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

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
