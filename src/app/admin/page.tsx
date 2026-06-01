"use client";

import { DemoProvider } from "@/lib/demo/store";
import { AppShell } from "@/components/layout/AppShell";
import { AdminDashboard } from "@/components/AdminDashboard";
import { DEMO_ADMIN_STATS } from "@/lib/demo/data";

export default function AdminPage() {
  return (
    <DemoProvider>
      <AppShell isAdmin>
        <AdminDashboard initialStats={DEMO_ADMIN_STATS} demo />
      </AppShell>
    </DemoProvider>
  );
}
