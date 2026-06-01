import { DemoProvider } from "@/lib/demo/store";
import { AppShell } from "@/components/layout/AppShell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <DemoProvider>
      <AppShell isAdmin>{children}</AppShell>
    </DemoProvider>
  );
}
