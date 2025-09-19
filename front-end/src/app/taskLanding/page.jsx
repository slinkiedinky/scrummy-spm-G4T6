"use client";
import { useState, useEffect } from 'react';
import { Lock } from 'lucide-react';
import { useRouter } from "next/navigation";
import { db, auth } from '@/lib/firebase';
import { doc, getDoc } from "firebase/firestore";
import Header from '@/app/components/Header';
import AuthGuard from '@/app/components/AuthGuard';


export default function TaskOverview() {
  const router = useRouter();
  const [userData, setUserData] = useState({ fullName: "", role: "" });

  useEffect(() => {
    const fetchUserData = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setUserData({
            fullName: data.fullName || "",
            role: data.role || "Staff",
          });
        }
      } catch (err) {
        console.error("Failed to fetch user data:", err);
      }
    };

    fetchUserData();
  }, []);
  
  return (
  <AuthGuard>
    <div className="min-h-screen bg-gradient-to-br from-gray-200 to-gray-400">
      {/* Header stays at top */}
      <Header title="Task Overview" userData={userData} />
      {/* Centered Card */}
      <div className="flex items-center justify-center p-4 min-h-[calc(100vh-64px)]">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            {/* Card Header */}
            <div className="px-8 pt-8 pb-6 text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Task Overview</h1>
            </div>
          </div>
        </div>
      </div>
    </div>
  </AuthGuard>
);
}