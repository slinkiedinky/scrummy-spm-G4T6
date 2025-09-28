import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import AuthGuard from "@/components/AuthGuard";
import { Sidebar } from "@/components/Sidebar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Scrummy",
  description: "Project management dashboard",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-background antialiased`}>
        <AuthGuard>
          <div className="flex h-screen bg-background">
            <Sidebar />
            <main className="flex-1 overflow-hidden">{children}</main>
          </div>
        </AuthGuard>
      </body>
    </html>
  );
}
