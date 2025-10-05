"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { auth } from "@/lib/firebase"


const ROLE_PERMISSIONS = {
  HR: ['tasks', 'projects', 'analytics', 'usermgmt'],
  Manager: ['tasks', 'projects', 'analytics'],
  Staff: ['tasks', 'projects', 'analytics']
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

export function RoleGuard({ children, allowedRoles, redirectTo = "/tasks" }) {
  const router = useRouter()
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkAccess = async () => {
      const user = auth.currentUser
      
      if (!user) {
        router.replace("/")
        return
      }

      const userData = await fetchUserData(user.uid)
      
      if (!allowedRoles.includes(userData.role)) {
        router.replace(redirectTo)
        return
      }
      
      setIsAuthorized(true)
      setIsLoading(false)
    }

    checkAccess()
  }, [router, allowedRoles, redirectTo])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Verifying access...</div>
      </div>
    )
  }

  return isAuthorized ? children : null
}
