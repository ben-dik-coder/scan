import { AppShell } from "@/components/layout/AppShell";
import { getProfile } from "@/lib/auth";
import { DemoProvider } from "@/lib/demo/store";
import "./app-critical.css";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();

  return (
    <DemoProvider>
      <AppShell isAdmin={profile?.role === "admin"}>{children}</AppShell>
    </DemoProvider>
  );
}
