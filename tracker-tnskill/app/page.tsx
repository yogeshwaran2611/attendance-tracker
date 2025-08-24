"use client"

import { useState } from "react"
import { LoginForm } from "@/components/login-form"
import { AdminDashboard } from "@/components/admin-dashboard"
import { UserDashboard } from "@/components/user-dashboard"

export default function Home() {
  const [user, setUser] = useState<{ type: "admin" | "user"; username: string } | null>(null)

  const handleLogin = (username: string, password: string) => {
    // Frontend-only authentication with hardcoded credentials
    if (username === "admin" && password === "admin123") {
      setUser({ type: "admin", username })
    } else if (username === "user" && password === "user123") {
      setUser({ type: "user", username })
    } else {
      throw new Error("Invalid credentials")
    }
  }

  const handleLogout = () => {
    setUser(null)
  }

  if (!user) {
    return <LoginForm onLogin={handleLogin} />
  }

  return (
    <div className="min-h-screen bg-background">
      {user.type === "admin" ? (
        <AdminDashboard user={user} onLogout={handleLogout} />
      ) : (
        <UserDashboard user={user} onLogout={handleLogout} />
      )}
    </div>
  )
}
