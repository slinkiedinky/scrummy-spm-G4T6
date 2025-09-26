"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";

export default function AuthGuard({ children }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (cancelled) return;
      if (user) {
        setChecked(true);
      } else {
        router.replace("/");
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [router]);

  if (!checked) return null;

  return <>{children}</>;
}
