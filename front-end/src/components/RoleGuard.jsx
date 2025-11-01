"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { auth } from "@/lib/firebase"


const ROLE_PERMISSIONS = {
  HR: ['tasks', 'usermgmt'],
  Manager: ['tasks', 'projects', 'analytics', 'timeline'],
  Staff: ['tasks', 'projects', 'timeline'],
}

const fetchUserData = async (userId) => {
  try {
    const response = await fetch(`http://localhost:5000/api/users/${userId}`);

    if (!response.ok) {
      console.log("API endpoint not found, using fallback data")
      return {
        role: "Staff",
      }
    }

    const contentType = response.headers.get("content-type")
    if (!contentType || !contentType.includes("application/json")) {
      console.log("Response is not JSON, using fallback data")
      return {
        role: "Staff",
      }
    }

    const userData = await response.json()
    return userData
  } catch (error) {
    console.log("API call failed, using fallback data")
    return {
      role: "Staff",
    }
  }
}

export function RoleGuard({children}) {
  const router = useRouter()
  const pathname = usePathname();
  const currentSection = pathname.split("/")[1]; // e.g. '/projects/123' → 'projects'
  const [status, setStatus] = useState("loading") // "loading" | "authorized" | "unauthorized" | "unauthenticated"

  useEffect(() => {
    let isMounted = true;

    const checkAccess = async () => {
      const user = auth.currentUser;
      if (!user) {
        if (isMounted) setStatus("unauthent icated");
        return;
      }

      const userData = await fetchUserData(user.uid);
      const role = userData?.role;

      if (!ROLE_PERMISSIONS[role]?.includes(currentSection)) {
        if (isMounted) setStatus("unauthorized");
        return;
      }

      if (isMounted) setStatus("authorized");
    };

    checkAccess();
    return () => {
      isMounted = false;
    };
  }, [currentSection]);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Verifying access...</div>
      </div>
    )
  }

  if (status === "unauthorized" || status === "unauthenticated") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
        <h1 className="text-2xl font-semibold text-red-600">
          You are not authorized to view this page.
        </h1>
        <button
          onClick={() => router.push("/tasks")}
          className="px-4 py-2 text-white font-semibold bg-gray-400 rounded-lg hover:bg-gray-500"
        >
          Go to Tasks
        </button>
      </div>
    )
  }

  return children
}