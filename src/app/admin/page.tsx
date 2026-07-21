"use client";

import RequireAuth from "@/components/RequireAuth";
import AdminDashboard from "./AdminDashboard";

export default function AdminPage() {
  return (
    <RequireAuth adminOnly>
      <AdminDashboard />
    </RequireAuth>
  );
}
