"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  RiMovieLine,
  RiVideoLine,
  RiUploadCloudLine,
  RiDashboardLine,
  RiLoginBoxLine,
  RiUserAddLine,
  RiLogoutBoxLine,
  RiAccountCircleLine,
  RiArrowDownSLine,
  type RemixiconComponentType,
} from "@remixicon/react";

/**
 * A single nav destination. The icon always shows; the label collapses away on
 * small screens so the bar never overflows on mobile (icon-only there,
 * icon+label from `sm` up). `active` gets a filled-in treatment so the current
 * section is obvious.
 */
function NavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: RemixiconComponentType;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors ${
        active
          ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
          : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
      }`}
    >
      <Icon size={18} aria-hidden />
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}

/**
 * Account dropdown: a profile-icon button that toggles a small menu showing the
 * signed-in email, role, and a log-out action. Click to open; closes on
 * outside-click, Escape, or when a route change is triggered from inside it.
 * Preferred over an inline email + button so the bar stays uncluttered.
 */
function ProfileMenu({ email, role, onLogout }: { email: string; role: string; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative ml-1">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className={`flex items-center gap-1 rounded-md px-2 py-1.5 transition-colors cursor-pointer ${
          open
            ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
            : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        }`}
      >
        <RiAccountCircleLine size={22} aria-hidden />
        <RiArrowDownSLine
          size={14}
          aria-hidden
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
            <p className="text-xs text-zinc-400 dark:text-zinc-500">Signed in as</p>
            <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100" title={email}>
              {email}
            </p>
            <span className="mt-1 inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              {role}
            </span>
          </div>
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900 cursor-pointer"
          >
            <RiLogoutBoxLine size={18} aria-hidden />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

export default function NavBar() {
  const { user, isHydrated, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <header className="border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
        >
          <RiMovieLine size={20} className="text-blue-600 dark:text-blue-400" aria-hidden />
          Media Processing
        </Link>

        <div className="flex items-center gap-1 text-sm">
          {/* Until hydration finishes we don't know the auth state, so render
              nothing rather than flashing the wrong set of links. */}
          {!isHydrated ? null : user ? (
            <>
              <NavLink href="/" label="Library" icon={RiVideoLine} active={pathname === "/"} />
              {user.role === "admin" && (
                <NavLink
                  href="/admin"
                  label="Admin"
                  icon={RiDashboardLine}
                  active={pathname.startsWith("/admin")}
                />
              )}
              {/* Upload is the primary action → accent button, not a plain link. */}
              <Link
                href="/upload"
                aria-current={pathname === "/upload" ? "page" : undefined}
                className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 font-medium text-white transition-colors hover:bg-blue-500"
              >
                <RiUploadCloudLine size={18} aria-hidden />
                <span className="hidden sm:inline">Upload</span>
              </Link>
              <ProfileMenu email={user.email} role={user.role} onLogout={handleLogout} />
            </>
          ) : (
            <>
              <NavLink
                href="/login"
                label="Log in"
                icon={RiLoginBoxLine}
                active={pathname === "/login"}
              />
              {/* Register is the primary CTA for a logged-out visitor. */}
              <Link
                href="/register"
                aria-current={pathname === "/register" ? "page" : undefined}
                className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 font-medium text-white transition-colors hover:bg-blue-500"
              >
                <RiUserAddLine size={18} aria-hidden />
                <span className="hidden sm:inline">Register</span>
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
