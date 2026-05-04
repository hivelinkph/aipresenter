import { AuthGuard } from "@/components/AuthGuard";
import { DashSidebar } from "@/components/DashSidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="flex min-h-screen">
        <DashSidebar />
        <main className="flex-1 overflow-x-hidden">{children}</main>
      </div>
    </AuthGuard>
  );
}
