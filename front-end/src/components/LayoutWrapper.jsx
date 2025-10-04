"use client";
import { usePathname } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import { Sidebar } from "@/components/Sidebar";

export default function LayoutWrapper({ children }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/";

  if (isLoginPage) {
    return <main>{children}</main>;
  }

  return (
    <AuthGuard>
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </AuthGuard>
  );
}
