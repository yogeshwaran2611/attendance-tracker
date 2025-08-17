"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Upload, FileSpreadsheet, CheckCircle, FolderOpen, LogIn } from "lucide-react"
import * as XLSX from "xlsx"

interface DriveFile {
  id: string
  name: string
  createdTime: string
  size: string
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
    gapi: {
      load: (api: string, callback: () => void) => void
      client: {
        init: (config: any) => Promise<void>
        drive: {
          files: {
            list: (params: any) => Promise<any>
            create: (params: any) => Promise<any>
            update: (params: any) => Promise<any>
          }
        }
        sheets: {
          spreadsheets: {
            create: (params: any) => Promise<any>
            values: {
              update: (params: any) => Promise<any>
              get: (params: any) => Promise<any>
            }
          }
        }
        // This is the corrected line: Add setToken to the gapi.client object
        setToken: (token: { access_token: string } | null) => void
      }
    }
  }
}

export function UploadFile() {
  const [file, setFile] = useState<File | null>(null)
  const [district, setDistrict] = useState("")
  const [collegeType, setCollegeType] = useState("")
  const [collegeCode, setCollegeCode] = useState("")
  const [collegeName, setCollegeName] = useState("")
  const [uploading, setUploading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([])
  const [loadingFiles, setLoadingFiles] = useState(true)
  const [error, setError] = useState("")
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [userEmail, setUserEmail] = useState("")
  const [accessToken, setAccessToken] = useState("")
  const [tokenClient, setTokenClient] = useState<any>(null)

  const districts = [
  "Ariyalur",
  "Chengalpattu",
  "Chennai",
  "Coimbatore",
  "Cuddalore",
  "Dharmapuri",
  "Dindigul",
  "Erode",
  "Kallakurichi",
  "Kanchipuram",
  "Kanyakumari",
  "Karur",
  "Krishnagiri",
  "Madurai",
  "Mayiladuthurai",
  "Nagapattinam",
  "Namakkal",
  "Nilgiris",
  "Perambalur",
  "Pudukkottai",
  "Ramanathapuram",
  "Ranipet",
  "Salem",
  "Sivaganga",
  "Tenkasi",
  "Thanjavur",
  "Theni",
  "Thoothukudi",
  "Tiruchirappalli",
  "Tirunelveli",
  "Tirupathur",
  "Tiruppur",
  "Tiruvallur",
  "Tiruvannamalai",
  "Tiruvarur",
  "Vellore",
  "Viluppuram",
  "Virudhunagar",
]

  useEffect(() => {
    checkAuthStatus()
    initializeGoogleAPIs()
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      loadDriveFiles()
    }
  }, [isAuthenticated])

  const checkAuthStatus = () => {
    const storedAuth = localStorage.getItem("googleAuth")
    if (storedAuth) {
      const authData = JSON.parse(storedAuth)
      if (authData.expiresAt > Date.now()) {
        setIsAuthenticated(true)
        setUserEmail(authData.email)
        setAccessToken(authData.accessToken)
        window.gapi.client.setToken({ access_token: authData.accessToken })
        console.log("[v0] User already authenticated:", authData.email)
      } else {
        localStorage.removeItem("googleAuth")
      }
    }
  }

  const initializeGoogleAPIs = () => {
    const gisScript = document.createElement("script")
    gisScript.src = "https://accounts.google.com/gsi/client"
    gisScript.async = true
    gisScript.defer = true

    const gapiScript = document.createElement("script")
    gapiScript.src = "https://apis.google.com/js/api.js"
    gapiScript.async = true
    gapiScript.defer = true

    let scriptsLoaded = 0
    const onScriptLoad = () => {
      scriptsLoaded++
      if (scriptsLoaded === 2) {
        initializeClients()
      }
    }

    gisScript.onload = onScriptLoad
    gapiScript.onload = onScriptLoad

    document.head.appendChild(gisScript)
    document.head.appendChild(gapiScript)
  }

  const initializeClients = () => {
    window.gapi.load("client", async () => {
      await window.gapi.client.init({
        apiKey: process.env.NEXT_PUBLIC_GOOGLE_API_KEY,
        discoveryDocs: [
          "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest",
          "https://www.googleapis.com/discovery/v1/apis/sheets/v4/rest",
        ],
      })

      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: "1036553970217-nilhklk5t742d124hvc8tmuomtjvk9mq.apps.googleusercontent.com",
        scope:
          "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.email",
        callback: async (response: any) => {
          if (response.access_token) {
            setAccessToken(response.access_token)
            window.gapi.client.setToken({ access_token: response.access_token })

            try {
              const userInfoResponse = await fetch(
                `https://www.googleapis.com/oauth2/v2/userinfo?access_token=${response.access_token}`,
              )
              const userInfo = await userInfoResponse.json()

              const authData = {
                accessToken: response.access_token,
                email: userInfo.email,
                expiresAt: Date.now() + 3600 * 1000,
              }
              localStorage.setItem("googleAuth", JSON.stringify(authData))

              setIsAuthenticated(true)
              setUserEmail(userInfo.email)
              setError("")
            } catch (error) {
              console.error("[v0] Error getting user info:", error)
              setError("Failed to get user information. Please try again.")
            }
          }
        },
      })

      setTokenClient(client)
    })
  }

  const handleGoogleSignIn = () => {
    if (tokenClient) {
      tokenClient.requestAccessToken()
    } else {
      setError("Google authentication not initialized. Please refresh the page.")
    }
  }

  const handleSignOut = () => {
    localStorage.removeItem("googleAuth")
    setIsAuthenticated(false)
    setAccessToken("")
    setUserEmail("")
    window.gapi.client.setToken(null)
    console.log("[v0] Signed out successfully")
  }

  const loadDriveFiles = async () => {
    if (!isAuthenticated) {
      setLoadingFiles(false)
      return
    }

    setLoadingFiles(true)
    setError("")

    try {
      const response = await window.gapi.client.drive.files.list({
        q: "'1EaWG4FO4eW8qrqcvnQoWzdsSYM9R4Y8N' in parents and trashed=false",
        fields: "files(id,name,createdTime,size)",
      })

      const files =
        response.result.files?.map((file: any) => ({
          id: file.id,
          name: file.name,
          createdTime: file.createdTime,
          size: file.size || "Unknown",
        })) || []

      setDriveFiles(files)
      console.log("[v0] Files loaded successfully:", files.length)
    } catch (error) {
      console.error("[v0] Error loading files:", error)
      setError("Error loading files from Google Drive")
      setDriveFiles([])
    } finally {
      setLoadingFiles(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile && selectedFile.name.endsWith(".xlsx")) {
      setFile(selectedFile)
      setSuccess(false)
      setError("")
      console.log("[v0] File selected:", selectedFile.name)
    } else {
      setError("Please select a valid .xlsx file with format: Branch | Register Number | Student Name")
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAuthenticated) {
      setError("Please sign in to Google first")
      return
    }
    if (!file || !district || !collegeType || !collegeCode || !collegeName) {
      setError("Please fill all fields and select a file")
      return
    }

    setUploading(true)
    setError("")
    setSuccess(false)

    try {
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: "array" })
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

      if (!jsonData[0] || jsonData[0].length < 3) {
        throw new Error("Invalid file format. Expected columns: Branch | Register Number | Student Name")
      }

      const sheetTitle = `${collegeName} - ${collegeCode}`
      const spreadsheetResponse = await window.gapi.client.sheets.spreadsheets.create({
        properties: {
          title: sheetTitle,
        },
        sheets: [
          {
            properties: {
              title: "Attendance",
              gridProperties: { rowCount: 1000, columnCount: 50 },
            },
          },
          {
            properties: {
              title: "Test",
              gridProperties: { rowCount: 1000, columnCount: 50 },
            },
          },
        ],
      })

      const spreadsheetId = spreadsheetResponse.result.spreadsheetId

      const attendanceHeaders = [
        "S.No",
        "District",
        "College Type",
        "College Name",
        "Branch",
        "Reg. No.",
        "Student Name",
        "Total Sessions",
        "Total Attended",
      ]

      const testHeaders = [
        "S.No",
        "District",
        "College Type",
        "College Name",
        "Branch",
        "Reg. No.",
        "Student Name",
        "Total Tests",
        "Tests Attended",
      ]

      const attendanceData = [
        ["Name:", "", "", "", "", "", "", "", ""],
        ["Email:", "", "", "", "", "", "", "", ""],
        ["Mobile:", "", "", "", "", "", "", "", ""],
        attendanceHeaders,
      ]

      const testData = [
        ["Name:", "", "", "", "", "", "", "", ""],
        ["Email:", "", "", "", "", "", "", "", ""],
        ["Mobile:", "", "", "", "", "", "", "", ""],
        testHeaders,
      ]

      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i]
        if (row && row.length >= 3) {
          const studentRow = [i, district, collegeType, collegeName, row[0], row[1], row[2], 0, 0]
          attendanceData.push(studentRow)

          const testRow = [i, district, collegeType, collegeName, row[0], row[1], row[2], 0, 0]
          testData.push(testRow)
        }
      }

      await window.gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId,
        range: "Attendance!A1",
        valueInputOption: "RAW",
        values: attendanceData,
      })

      await window.gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId,
        range: "Test!A1",
        valueInputOption: "RAW",
        values: testData,
      })

      await window.gapi.client.drive.files.update({
        fileId: spreadsheetId,
        addParents: "1EaWG4FO4eW8qrqcvnQoWzdsSYM9R4Y8N",
        removeParents: "root",
      })

      await createOrUpdateMasterSheet(spreadsheetId, sheetTitle, jsonData.length - 1)

      setSuccess(true)
      setFile(null)
      setDistrict("")
      setCollegeType("")
      setCollegeCode("")
      setCollegeName("")

      const fileInput = document.getElementById("file-upload") as HTMLInputElement
      if (fileInput) fileInput.value = ""
    } catch (error) {
      console.error("[v0] Upload error:", error)
      setError(`Upload failed: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setUploading(false)
    }
  }

  // Hardcode the master sheet ID to ensure all users update the same file
  const MASTER_SHEET_ID = "1uHHHkNBX-dWcmhQ3-hTN8ka_wNSEf2x114l9IFUPZ8g"

  const createOrUpdateMasterSheet = async (collegeSheetId: string, sheetTitle: string, totalStudents: number) => {
    try {
      const existingData = await window.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: MASTER_SHEET_ID,
        range: "Sheet1!A:J", // Ensure the range is large enough to fetch all data
      });

      const rows = existingData.result.values || [];
      const nextRow = rows.length + 1;

      const collegeSheetLink = `https://docs.google.com/spreadsheets/d/${collegeSheetId}`;
      const newRowData = [
        [
          nextRow - 1,
          district,
          collegeType,
          collegeCode,
          collegeName,
          totalStudents,
          0,
          0,
          collegeSheetLink,
          userEmail,
        ],
      ];

      await window.gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: MASTER_SHEET_ID,
        range: `Sheet1!A${nextRow}`,
        valueInputOption: "RAW",
        values: newRowData,
      });

      console.log("[v0] Master sheet updated successfully");
    } catch (error) {
      console.error("[v0] Error updating master sheet:", error);
      // It's a good idea to inform the user if there's an issue with updating the master sheet.
      setError("Failed to update the master sheet. Please ensure you have write permissions.");
    }
  };

  return (
    <div className="space-y-6">
      {!isAuthenticated && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LogIn className="w-5 h-5" />
              Google Authentication Required
            </CardTitle>
            <CardDescription>Sign in to Google to upload files and access Google Drive</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleGoogleSignIn} className="w-full">
              <LogIn className="w-4 h-4 mr-2" />
              Sign in with Google
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Upload College Excel File
            {isAuthenticated && (
              <div className="ml-auto flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{userEmail}</span>
                <Button variant="outline" size="sm" onClick={handleSignOut} className="bg-transparent">
                  Sign Out
                </Button>
              </div>
            )}
          </CardTitle>
          <CardDescription>Upload Excel file with format: Branch | Register Number | Student Name</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert className="mb-6 border-red-200 bg-red-50">
              <AlertDescription className="text-red-800">{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="mb-6 border-green-200 bg-green-50">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <AlertDescription className="text-green-800">
                College sheet created successfully with Attendance and Test tabs!
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="district">District</Label>
                <Select value={district} onValueChange={setDistrict}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select district" />
                  </SelectTrigger>
                  <SelectContent>
                    {districts.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="college-type">College Type</Label>
                <Select value={collegeType} onValueChange={setCollegeType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Arts">Arts</SelectItem>
                    <SelectItem value="Engineering">Engineering</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="college-code">College Code</Label>
                <Input
                  id="college-code"
                  value={collegeCode}
                  onChange={(e) => setCollegeCode(e.target.value)}
                  placeholder="e.g., CHE001"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="college-name">College Name</Label>
                <Input
                  id="college-name"
                  value={collegeName}
                  onChange={(e) => setCollegeName(e.target.value)}
                  placeholder="Enter college name"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="file-upload">Excel File (.xlsx)</Label>
              <div className="flex items-center gap-4">
                <Input
                  id="file-upload"
                  type="file"
                  accept=".xlsx"
                  onChange={handleFileChange}
                  className="flex-1"
                  required
                />
                {file && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileSpreadsheet className="w-4 h-4" />
                    {file.name}
                  </div>
                )}
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={uploading || !isAuthenticated}>
              {uploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Creating College Sheet...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Create College Sheet
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5" />
            Google Drive Files
          </CardTitle>
          <CardDescription>Attendance tracking sheets in Google Drive</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingFiles ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="ml-2 text-muted-foreground">Loading files...</span>
            </div>
          ) : driveFiles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No attendance sheets found</p>
              <p className="text-sm">Upload your first Excel file to create a tracking sheet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {driveFiles.map((file) => (
                <div key={file.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(file.createdTime).toLocaleDateString()} • {file.size}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}