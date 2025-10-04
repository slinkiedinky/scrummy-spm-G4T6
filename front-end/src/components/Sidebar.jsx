"use client"

import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { signOut } from "firebase/auth"
import { ChevronLeft, LayoutDashboard, FolderOpen, BarChart3, LogOut, Users, Bell } from "lucide-react"
import { cn } from "@/lib/utils"
import { db, auth } from "@/lib/firebase"
import { collection, query, where, onSnapshot } from "firebase/firestore"
import { onAuthStateChanged } from "firebase/auth"

const navigationItems = [
  {
    name: "Tasks",
    icon: LayoutDashboard,
    href: "/tasks",
  },
  {
    name: "Projects",
    icon: FolderOpen,
    href: "/projects",
  },
  {
    name: "Analytics",
    icon: BarChart3,
    href: "/analytics",
  },
]

const fetchUserData = async (userId) => {
  try {
    const response = await fetch(`http://localhost:5000/api/users/${userId}`);

    if (!response.ok) {
      console.log("API endpoint not found, using fallback data")
      return {
        fullName: "John Doe",
        role: "Staff",
      }
    }

    const contentType = response.headers.get("content-type")
    if (!contentType || !contentType.includes("application/json")) {
      console.log("Response is not JSON, using fallback data")
      return {
        fullName: "John Doe",
        role: "Staff",
      }
    }

    const userData = await response.json()
    return userData
  } catch (error) {
    console.log("API call failed, using fallback data")
    return {
      fullName: "John Doe",
      role: "Staff",
    }
  }
}

export function Sidebar({ className }) {

  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [userData, setUserData] = useState({
    fullName: "",
    role: "",
    initials: "",
  })
  const [isLoadingUser, setIsLoadingUser] = useState(true)
  const router = useRouter()
  const [unreadCount, setUnreadCount] = useState(0)
  useEffect(() => {
    const loadUserData = async () => {
      const userId = auth.currentUser?.uid
      const userDoc = await fetchUserData(userId)

      if (userDoc) {
        // Extract initials from full name
        const initials = userDoc.fullName
          .split(" ")
          .map((name) => name.charAt(0))
          .join("")
          .toUpperCase()

        setUserData({
          fullName: userDoc.fullName || "",
          role: userDoc.role || "Staff",
          initials: initials || "IT",
        })
      }

      setIsLoadingUser(false)
    }

    loadUserData()
  }, [])
  useEffect(() => {
  let unsubscribeSnapshot = null

  const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
    // cleanup old listener
    if (unsubscribeSnapshot) {
      unsubscribeSnapshot()
      unsubscribeSnapshot = null
    }

    if (user) {
      const q = query(
        collection(db, "notifications"),
        where("userId", "==", user.uid),
        where("isRead", "==", false)
      )

      unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
        setUnreadCount(snapshot.size)
      })
    } else {
      setUnreadCount(0) // reset when logged out
    }
  })

  return () => {
    unsubscribeAuth()
    if (unsubscribeSnapshot) unsubscribeSnapshot()
  }
}, [])

  const handleLogout = async () => {
    try {
      await signOut(auth)
      router.replace("/")
    } catch (err) {
      console.error("Logout failed:", err)
    }
  }

  return (
    <div
      className={cn(
        "flex h-screen w-80 flex-col border-r border-gray-200 bg-white transition-all duration-300",
        isCollapsed && "w-16",
        className,
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex h-16 items-center border-b border-gray-200 transition-all duration-300",
          isCollapsed ? "justify-center px-2" : "justify-between px-6",
        )}
      >
        {!isCollapsed && <h1 className="text-2xl font-bold text-gray-900">TaskFlow</h1>}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="h-8 w-8 flex-shrink-0 flex items-center justify-center rounded-md hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft className={cn("h-4 w-4 transition-transform duration-300", isCollapsed && "rotate-180")} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-2 p-4">
        {navigationItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center rounded-lg text-sm font-medium transition-all duration-300",
                isActive ? "bg-blue-500 text-white" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
                isCollapsed ? "justify-center h-10 w-10 mx-auto" : "gap-3 px-3 py-3",
              )}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {!isCollapsed && <span>{item.name}</span>}
            </Link>
          )
        })}
      </nav>

      {/* User Profile & Logout */}
      <div className="border-t border-gray-200 p-4">
        <div className={cn("flex items-center transition-all duration-300", isCollapsed ? "justify-center" : "justify-between")}>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 flex-shrink-0 rounded-full bg-blue-500 flex items-center justify-center">
              <span className="text-white font-medium text-sm">{isLoadingUser ? "..." : userData.initials}</span>
            </div>
            {!isCollapsed && (
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-900">
                  {isLoadingUser ? "Loading..." : userData.fullName}
                </span>
                <span className="text-xs text-gray-500">{isLoadingUser ? "" : userData.role}</span>
              </div>
            )}
          </div>

          {/* Logout Button */}
          {!isCollapsed && (
            <div className="flex items-center gap-2">
              {/* Notification Bell */}
              <button
                onClick={() => router.push("/notifications")}
                className="relative flex items-center justify-center h-8 w-8 rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                title="Notifications"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="flex items-center justify-center h-8 w-8 rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}