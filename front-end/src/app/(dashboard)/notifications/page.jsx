
"use client"


import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Bell, Calendar, Check, X, ClipboardList } from "lucide-react"
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
  deleteDoc,
} from "firebase/firestore"
import { db, auth } from "@/lib/firebase"

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([])
  const router = useRouter();

  useEffect(() => {
    if (!auth.currentUser) {
      setNotifications([]);
      return;
    }

    //  read directly from "notifications" collection
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", auth.currentUser.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => {
        const notif = doc.data();
        return {
          id: doc.id,
          ...notif,
          createdAt: notif.createdAt?.toDate
            ? notif.createdAt.toDate()
            : (notif.createdAt ? new Date(notif.createdAt) : new Date()),
        };
      });
      setNotifications(data);
    }, (error) => {
      // Handle permission errors gracefully
      setNotifications([]);
    });
  }, []);

  // (Removed duplicate handleNotificationClick definition)

  useEffect(() => {
    if (!auth.currentUser) {
      setNotifications([]);
      return;
    }

    //  read directly from "notifications" collection
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", auth.currentUser.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => {
        const notif = doc.data();
        return {
          id: doc.id,
          ...notif,
          createdAt: notif.createdAt?.toDate
            ? notif.createdAt.toDate()
            : (notif.createdAt ? new Date(notif.createdAt) : new Date()),
        };
      });
      setNotifications(data);
    }, (error) => {
      // Handle permission errors gracefully
      setNotifications([]);
    });

    return () => unsubscribe();
  }, [auth.currentUser])

  // (Removed duplicate code above main NotificationsPage export)

  // ...rest of the code...

  // Navigation handler for notification click
  const handleNotificationClick = async (notif) => {
    await markAsRead(notif.id);
    // If both projectId and taskId exist, go to task details, else fallback to project
    if (notif.projectId && notif.taskId) {
      router.push(`/projects/${notif.projectId}?task=${notif.taskId}`);
    } else if (notif.projectId) {
      router.push(`/projects/${notif.projectId}`);
    }
  };

  // Helper: count unread notifications
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // Helper: mark all as read
  const markAllRead = async () => {
    const updates = notifications.map((n) =>
      updateDoc(doc(db, "notifications", n.id), { isRead: true })
    );
    await Promise.all(updates);
  };

  // Helper: dismiss notification
  const dismissNotification = async (id) => {
    await deleteDoc(doc(db, "notifications", id));
  };

  // Helper: mark as read
  const markAsRead = async (id) => {
    try {
      await updateDoc(doc(db, "notifications", id), { isRead: true });
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  };

  // Helper: format time ago
  const formatTimeAgo = (date) => {
    const diff = (new Date() - new Date(date)) / 1000;
    if (diff < 60) return "less than a minute ago";
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    return `${Math.floor(diff / 86400)} days ago`;
  };

  return (
    <div className="p-6 w-full min-h-screen bg-gray-50 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-3">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <div className="relative">
            <Bell className="h-6 w-6 text-gray-700" />
            {unreadCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </div>
          Notifications
        </h1>

        <div className="flex items-center gap-4">
          <button
            onClick={markAllRead}
            className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
          >
            <Check className="h-4 w-4" /> Mark all read
          </button>
        </div>
      </div>

      {/* Notifications List */}
      {notifications.map((notif) => (
        <div
          key={notif.id}
          onClick={() => handleNotificationClick(notif)}
          className={`flex items-start gap-3 p-4 border rounded-lg shadow-sm cursor-pointer transition
            ${notif.isRead ? "bg-white border-gray-200" : "bg-blue-50 border-blue-300"}`}
        >
          {/* Icon */}
          <div className="mt-1 text-red-500">
            {notif.icon === "calendar" && <Calendar className="h-5 w-5" />}
            {notif.icon === "bell" && <Bell className="h-5 w-5" />}
            {notif.icon === "clipboardlist" && <ClipboardList className="h-5 w-5" />}
            {!notif.icon && <Bell className="h-5 w-5" />}
          </div>

          {/* Content */}
          <div className="flex-1">
            {notif.type === "add task" ? (
              <>
                <h2 className="font-medium text-gray-900">New Task Assigned</h2>
                <div className="text-sm text-gray-700">
                  <span className="font-semibold">Task:</span> {notif.title || "-"}
                </div>
                <div className="text-sm text-gray-700">
                  <span className="font-semibold">Project:</span> {notif.projectName || "-"}
                </div>
                <div className="text-sm text-gray-700">
                  <span className="font-semibold">Assigned by:</span> {notif.assignedByName || "-"}
                </div>
                {notif.description && (
                  <div className="text-sm text-gray-600 mt-1">
                    <span className="font-semibold">Description:</span> {notif.description}
                  </div>
                )}
                <div className="text-xs text-gray-400 mt-1">
                  {notif.createdAt ? formatTimeAgo(notif.createdAt) : ""}
                </div>
              </>
            ) : notif.type === "add collaborator" ? (
              <>
                <h2 className="font-medium text-gray-900">You've been added as a collaborator</h2>
                <div className="text-sm text-gray-700">
                  <span className="font-semibold">Task:</span> {notif.title || "-"}
                </div>
                <div className="text-sm text-gray-700">
                  <span className="font-semibold">Project:</span> {notif.projectName || "-"}
                </div>
                <div className="text-sm text-gray-700">
                  <span className="font-semibold">Added by:</span> {notif.assignedByName || "-"}
                </div>
                {notif.description && (
                  <div className="text-sm text-gray-600 mt-1">
                    <span className="font-semibold">Description:</span> {notif.description}
                  </div>
                )}
                <div className="text-xs text-gray-400 mt-1">
                  {notif.createdAt ? formatTimeAgo(notif.createdAt) : ""}
                </div>
              </>
            ) : notif.type === "deadline_reminder" ? (
              <>
                <h2 className="font-medium text-gray-900">📅 Upcoming Deadline Tomorrow</h2>
                <div className="text-sm text-gray-700">
                  <span className="font-semibold">Task:</span> {notif.title || "-"}
                </div>
                <div className="text-sm text-gray-700">
                  <span className="font-semibold">Project:</span> {notif.projectName || "-"}
                </div>
                {notif.message && (
                  <div className="text-sm text-orange-600 mt-1 font-medium">
                    {notif.message}
                  </div>
                )}
                {notif.description && (
                  <div className="text-sm text-gray-600 mt-1">
                    <span className="font-semibold">Description:</span> {notif.description}
                  </div>
                )}
                <div className="text-xs text-gray-400 mt-1">
                  {notif.createdAt ? formatTimeAgo(notif.createdAt) : ""}
                </div>
              </>
            ) : notif.type === "deadline_today" ? (
              <>
                <h2 className="font-medium text-red-600">⚠️ Deadline Today!</h2>
                <div className="text-sm text-gray-700">
                  <span className="font-semibold">Task:</span> {notif.title || "-"}
                </div>
                <div className="text-sm text-gray-700">
                  <span className="font-semibold">Project:</span> {notif.projectName || "-"}
                </div>
                {notif.message && (
                  <div className="text-sm text-red-600 mt-1 font-medium">
                    {notif.message}
                  </div>
                )}
                {notif.description && (
                  <div className="text-sm text-gray-600 mt-1">
                    <span className="font-semibold">Description:</span> {notif.description}
                  </div>
                )}
                <div className="text-xs text-gray-400 mt-1">
                  {notif.createdAt ? formatTimeAgo(notif.createdAt) : ""}
                </div>
              </>
            ) : (
              <>
                <h2 className="font-medium text-gray-900">{notif.title}</h2>
                {notif.message && <p className="text-sm text-gray-600">{notif.message}</p>}
                <p className="text-xs text-gray-400">
                  {notif.createdAt ? formatTimeAgo(notif.createdAt) : ""}
                </p>
              </>
            )}
          </div>

          {/* Actions */}
          <button
            onClick={(e) => {
              e.stopPropagation(); // prevent navigation when dismiss is clicked
              dismissNotification(notif.id);
            }}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
