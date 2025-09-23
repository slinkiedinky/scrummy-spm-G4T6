"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";

export default function AuthGuard({ children }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Immediate check
    const user = auth.currentUser;
    if (!user) {
      router.replace("/");
    } else {
      setChecked(true);
    }

    // Listen for changes
    const unsubscribe = auth.onAuthStateChanged((u) => {
      if (!u) {
        router.replace("/");
      } else {
        setChecked(true);
      }
    });

    return unsubscribe;
  }, [router]);

  // Don't render children until auth is confirmed
  if (!checked) return null;

  return <>{children}</>;
}