"use client"

import { RoleGuard } from "@/components/RoleGuard"
import { useState, useEffect } from "react"
import { Search, RefreshCw } from "lucide-react"
import { onAuthStateChanged } from "firebase/auth"
import { auth } from "@/lib/firebase"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

export default function UserManagementPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [allUsers, setAllUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalUser, setModalUser] = useState(null)
  const [selectedRole, setSelectedRole] = useState("")
  const [updatingRole, setUpdatingRole] = useState(false)
  const [currentUserId, setCurrentUserId] = useState(null)

  const roles = ["Staff", "Manager", "HR"]

  // Track logged-in user
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) setCurrentUserId(user.uid)
    })
    return () => unsubscribe()
  }, [])

  const fetchAllUsers = async () => {
    setLoading(true)
    try {
      const response = await fetch("http://localhost:5000/api/users")
      if (!response.ok) throw new Error("Failed to fetch users")
      const data = await response.json()
      setAllUsers(data.users || data || [])
    } catch (error) {
      console.error("Error fetching users:", error)
      alert("Failed to fetch users")
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchAllUsers()
  }, [])

  const filteredUsers = allUsers
    .filter((user) => user.id !== currentUserId)
    .filter((user) => {
      if (!searchQuery) return true
      const query = searchQuery.toLowerCase()
      return (
        (user.fullName || "").toLowerCase().includes(query) ||
        (user.email || "").toLowerCase().includes(query)
      )
    })

  const handleRoleChange = async () => {
    if (!modalUser) return
    setUpdatingRole(true)
    try {
      const response = await fetch(`http://localhost:5000/api/users/${modalUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: selectedRole }),
      })
      if (!response.ok) throw new Error("Failed to update role")

      setAllUsers((prev) =>
        prev.map((u) => (u.id === modalUser.id ? { ...u, role: selectedRole } : u))
      )
      setModalUser(null)
    } catch (error) {
      console.error("Error updating role:", error)
      alert("Failed to update role")
    }
    setUpdatingRole(false)
  }

  return (
    <RoleGuard allowedRoles={["HR"]}>
      <div className="flex-1 overflow-auto bg-white">
        <div className="max-w-5xl mx-auto p-8">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          </div>

          {/* Action Bar */}
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={fetchAllUsers}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh User List
            </button>
          </div>

          {/* Search Box */}
          <div className="bg-white rounded-lg border border-gray-200 mb-6">
            <div className="p-4 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Scrollable User List */}
            <div className="divide-y divide-gray-200 max-h-[500px] overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center text-gray-500">Loading users...</div>
              ) : filteredUsers.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-gray-900 font-medium mb-1">No users found</p>
                  <p className="text-gray-500 text-sm">Try adjusting your search.</p>
                </div>
              ) : (
                filteredUsers.map((user) => (
                  <div
                    key={user.id}
                    onClick={() => {
                      setModalUser(user)
                      setSelectedRole(user.role || "Staff")
                    }}
                    className="p-4 hover:bg-gray-50 transition-colors flex justify-between items-center cursor-pointer"
                  >
                    <div className="min-w-0">
                      <h3 className="text-sm font-medium text-gray-900 truncate">{user.fullName || "No name"}</h3>
                      <p className="text-sm text-gray-500 truncate">{user.email || "No email"}</p>
                    </div>
                    <Badge variant="secondary" className="ml-4 text-sm px-3 py-1">
                      {user.role || "Staff"}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Role Change Modal */}
        <Dialog open={!!modalUser} onOpenChange={() => setModalUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change Role</DialogTitle>
            </DialogHeader>

            {modalUser && (
              <div className="space-y-3">
                <Label className="text-xs text-gray-600 uppercase tracking-wide">User</Label>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mt-0">
                    <p className="text-sm text-gray-900 font-medium">{modalUser.fullName}</p>
                    <p className="text-xs text-gray-500">{modalUser.email}</p>
                </div>


                <div>
                  <Label htmlFor="role">Select Role</Label>
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger id="role" className="w-full mt-3">
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role} value={role}>
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <DialogFooter className="mt-6">
              <Button variant="outline" onClick={() => setModalUser(null)}>
                Cancel
              </Button>
              <Button onClick={handleRoleChange} disabled={updatingRole}>
                {updatingRole ? "Saving..." : "Confirm"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </RoleGuard>
  )
}
