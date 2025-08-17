"use client"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AttendanceMarking } from "@/components/attendance-marking"
import { TestMarking } from "@/components/test-marking"
import { LogOut, Users, ClipboardCheck, LogIn } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface UserDashboardProps {
  user: { type: "user"; username: string }
  onLogout: () => void
}

declare global {
  interface Window {
    google: {
      accounts: {
        oauth2: {
          initTokenClient: (config: any) => any
        }
      }
    }
  }
}

export function UserDashboard({ user, onLogout }: UserDashboardProps) {
  const [userEmail, setUserEmail] = useState("")
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [tokenClient, setTokenClient] = useState<any>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    checkAuthStatus()
    initializeGoogleAuth()
  }, [])

  const checkAuthStatus = () => {
    try {
      const authData = localStorage.getItem("googleAuth")
      if (authData) {
        const { email, accessToken, expiresAt } = JSON.parse(authData)
        if (Date.now() < expiresAt) {
          setUserEmail(email)
          setIsAuthenticated(true)
          console.log("[v0] User authenticated from localStorage:", email)
        } else {
          localStorage.removeItem("googleAuth")
        }
      }
    } catch (error) {
      console.error("[v0] Error checking auth status:", error)
      localStorage.removeItem("googleAuth")
    }
  }

  const initializeGoogleAuth = () => {
    const script = document.createElement("script")
    script.src = "https://accounts.google.com/gsi/client"
    script.onload = () => {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: "1036553970217-nilhklk5t742d124hvc8tmuomtjvk9mq.apps.googleusercontent.com",
        scope:
          "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/userinfo.email",
        callback: async (response: any) => {
          if (response.access_token) {
            try {
              const userInfoResponse = await fetch(
                `https://www.googleapis.com/oauth2/v2/userinfo?access_token=${response.access_token}`,
              )
              const userInfo = await userInfoResponse.json()

              const authData = {
                accessToken: response.access_token,
                email: userInfo.email,
                expiresAt: Date.now() + 3600 * 1000, // 1 hour
              }
              localStorage.setItem("googleAuth", JSON.stringify(authData))

              setIsAuthenticated(true)
              setUserEmail(userInfo.email)
              setError("")
              console.log("[v0] User authentication successful:", userInfo.email)
            } catch (error) {
              console.error("[v0] Error storing auth info:", error)
              setError("Failed to authenticate. Please try again.")
            }
          }
        },
      })
      setTokenClient(client)
    }
    document.head.appendChild(script)
  }

  const handleGoogleSignIn = () => {
    if (tokenClient) {
      tokenClient.requestAccessToken()
    } else {
      setError("Google authentication not initialized. Please refresh the page.")
    }
  }

  const handleLogout = () => {
    localStorage.removeItem("googleAuth")
    setIsAuthenticated(false)
    setUserEmail("")
    onLogout()
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-serif font-bold text-primary">TNSkill Tracker</h1>
            <p className="text-sm text-muted-foreground">
              Welcome, {userEmail || user.username}
              {!isAuthenticated && " (Not authenticated)"}
            </p>
          </div>
          <Button variant="outline" onClick={handleLogout} className="flex items-center gap-2 bg-transparent">
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {!isAuthenticated && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LogIn className="w-5 h-5" />
                Google Authentication Required
              </CardTitle>
              <CardDescription>Sign in to Google to mark attendance and access Google Sheets</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleGoogleSignIn} className="w-full">
                <LogIn className="w-4 h-4 mr-2" />
                Sign in with Google
              </Button>
              {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="attendance" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="attendance" className="flex items-center gap-2 text-xs sm:text-sm">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Attendance</span>
              <span className="sm:hidden">Attend</span>
            </TabsTrigger>
            <TabsTrigger value="tests" className="flex items-center gap-2 text-xs sm:text-sm">
              <ClipboardCheck className="w-4 h-4" />
              <span className="hidden sm:inline">Test Marks</span>
              <span className="sm:hidden">Tests</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="attendance">
            <AttendanceMarking userEmail={userEmail} isAuthenticated={isAuthenticated} />
          </TabsContent>

          <TabsContent value="tests">
            <TestMarking userEmail={userEmail} isAuthenticated={isAuthenticated} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
