"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Users, Save, CheckCircle, Download, Loader2 } from "lucide-react"
import { format } from "date-fns"

// Import react-datepicker and its styles
import DatePicker from "react-datepicker"
import "react-datepicker/dist/react-datepicker.css"
import "./custom-datepicker.css"

interface Student {
  sno: number
  regNo: string
  name: string
  branch: string
  district: string
  collegeType: string
  totalSessions: number
  totalAttended: number
  present: boolean
}

interface AttendanceMarkingProps {
  userEmail: string
  isAuthenticated: boolean
}

export function AttendanceMarking({ userEmail, isAuthenticated }: AttendanceMarkingProps) {
  const [selectedCollege, setSelectedCollege] = useState("")
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const [selectedBranch, setBranch] = useState("all")
  const [students, setStudents] = useState<Student[]>([])
  const [instructorName, setInstructorName] = useState("")
  const [instructorMobile, setInstructorMobile] = useState("")
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [colleges, setColleges] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [dataFetched, setDataFetched] = useState(false)
  const [sheetFileId, setSheetFileId] = useState<string>("")
  const [collegeDetails, setCollegeDetails] = useState({
    district: "",
    collegeType: "",
  })

  const branches = ["CSE", "ECE", "MECH", "CIVIL", "EEE", "IT"]

  // --- Initial file fetching for college dropdown ---
  useEffect(() => {
    if (isAuthenticated) {
      fetchCollegeFiles()
    }
  }, [isAuthenticated])

  const fetchCollegeFiles = async () => {
    setLoading(true)
    try {
      const authData = localStorage.getItem("googleAuth")
      if (!authData) return

      const { accessToken } = JSON.parse(authData)
      const folderId = "1EaWG4FO4eW8qrqcvnQoWzdsSYM9R4Y8N"

      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q='${folderId}' in parents and trashed=false and mimeType='application/vnd.google-apps.spreadsheet'&fields=files(id,name,createdTime,size)`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      )

      if (response.ok) {
        const data = await response.json()
        const collegeFiles = data.files
          .filter((file: any) => !file.name.toLowerCase().includes("master"))
          .map((file: any) => file.name)

        setColleges(collegeFiles)
      } else {
        console.error("[v0] Failed to fetch files:", response.status, response.statusText)
      }
    } catch (error) {
      console.error("[v0] Error fetching college files:", error)
    } finally {
      setLoading(false)
    }
  }

  // --- Student data fetching based on college and date ---
  const fetchStudentData = async () => {
    if (!selectedCollege || !selectedDate) {
      alert("Please select a college and a date first")
      return
    }

    setFetching(true)
    try {
      const authData = localStorage.getItem("googleAuth")
      if (!authData) return
      const { accessToken } = JSON.parse(authData)
      const folderId = "1EaWG4FO4eW8qrqcvnQoWzdsSYM9R4Y8N"

      const filesResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files?q='${folderId}' in parents and name='${selectedCollege}' and trashed=false and mimeType='application/vnd.google-apps.spreadsheet'&fields=files(id,name)`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      )

      if (filesResponse.ok) {
        const filesData = await filesResponse.json()
        const sheetFile = filesData.files[0]

        if (sheetFile) {
          setSheetFileId(sheetFile.id)

          // Fetch all data including headers to find attendance column
          const allDataResponse = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetFile.id}/values/Attendance!A1:Z1000`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            },
          )

          if (allDataResponse.ok) {
            const allSheetData = await allDataResponse.json()
            const allRows = allSheetData.values || []
            const headerRow = allRows[3] || [] // Header is on row 4 (index 3)

            const dateColumn = format(selectedDate, "dd/MM/yyyy")
            const dateColumnIndex = headerRow.findIndex((header: string) => header.trim() === dateColumn.trim())

            const studentDataRows = allRows.slice(4) // Student data starts from row 5 (index 4)

            const studentData: Student[] = studentDataRows
              .filter((row: any[]) => row[0] && row[5] && row[6]) // Filter out empty rows
              .map((row: any[], index: number) => {
                const isPresent = dateColumnIndex !== -1 && row[dateColumnIndex] === "P"
                return {
                  sno: Number.parseInt(row[0]) || index + 1,
                  regNo: row[5] || "",
                  name: row[6] || "",
                  branch: row[4] || "",
                  district: row[1] || "",
                  collegeType: row[2] || "",
                  totalSessions: Number.parseInt(row[7]) || 0,
                  totalAttended: Number.parseInt(row[8]) || 0,
                  present: isPresent,
                }
              })

            setStudents(studentData)
            setDataFetched(true)
          }
        }
      }
    } catch (error) {
      console.error("[v0] Error fetching student data:", error)
    } finally {
      setFetching(false)
    }
  }

  const filteredStudents =
    selectedBranch && selectedBranch !== "all"
      ? students.filter((student) => student.branch === selectedBranch)
      : students

  const handleStudentToggle = (sno: number) => {
    setStudents((prev) =>
      prev.map((student) => {
        if (student.sno === sno) {
          if (student.present) {
            alert("Attendance is already marked as 'Present' and cannot be changed to 'Absent'.")
            return student
          }
          return { ...student, present: !student.present }
        }
        return student
      }),
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCollege || !selectedDate || !instructorName || !userEmail || !instructorMobile || !sheetFileId) {
      alert("Please ensure all fields are filled and student data is fetched.")
      return
    }

    setSaving(true)
    setSuccess(false)

    try {
      const authData = localStorage.getItem("googleAuth")
      if (!authData) return
      const { accessToken } = JSON.parse(authData)

      const dateColumn = format(selectedDate, "dd/MM/yyyy")

      // Fetch the most current data to determine isNewSession
      const allSheetDataResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetFileId}/values/Attendance!A1:Z1000`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      )
      const allSheetData = await allSheetDataResponse.json()
      const headerRow = allSheetData.values[3] || []

      let dateColumnIndex = headerRow.findIndex((header: string) => header.trim() === dateColumn.trim())
      const isNewSession = dateColumnIndex === -1

      if (isNewSession) {
        dateColumnIndex = headerRow.length
      }

      const columnLetter = String.fromCharCode(65 + dateColumnIndex)

      const requests = []

      // Request to add the header data
      requests.push({
        range: `Attendance!${columnLetter}1:${columnLetter}4`,
        values: [
          [`${instructorName}`],
          [`${userEmail}`],
          [`${instructorMobile}`],
          [`${dateColumn}`],
        ],
      })

      // Separate requests for attendance and session count updates
      const attendanceUpdates = filteredStudents.map((student) => ({
        range: `Attendance!${columnLetter}${student.sno + 4}`,
        values: [[student.present ? "P" : "A"]],
      }))

      const sessionUpdates = filteredStudents.map((student) => {
        const studentRowNumber = student.sno + 4
        
        let newTotalSessions = student.totalSessions;
        let newTotalAttended = student.totalAttended;

        // If it's a new session, increment both sessions and attended count (if present)
        if (isNewSession) {
          newTotalSessions = student.totalSessions + 1;
          if (student.present) {
            newTotalAttended = student.totalAttended + 1;
          }
        } 
        // If it's an existing session and the student is marked present, and they weren't previously attended, increment attended count
        else if (student.present) {
            // This is the crucial fix: check if the student was previously absent on this date
            const previousAttendanceStatus = allSheetData.values[studentRowNumber - 1]?.[dateColumnIndex];
            if (previousAttendanceStatus !== "P") {
                newTotalAttended = student.totalAttended + 1;
            }
        }

        return {
          range: `Attendance!H${studentRowNumber}:I${studentRowNumber}`,
          values: [[newTotalSessions, newTotalAttended]],
        }
      })
      
      requests.push(...attendanceUpdates, ...sessionUpdates)

      const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetFileId}/values:batchUpdate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          data: requests,
          valueInputOption: "RAW",
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`Batch update failed: ${JSON.stringify(errorData)}`)
      }

      await updateMasterSheet(accessToken, selectedCollege, filteredStudents, isNewSession)

      setSaving(false)
      setSuccess(true)
      setDataFetched(false)
    } catch (error) {
      console.error("[v0] Error saving attendance:", error)
      setSaving(false)
      setSuccess(false)
    }
  }

  const updateMasterSheet = async (
  accessToken: string,
  collegeName: string,
  students: Student[],
  newSession: boolean,
) => {
  try {
    const folderId = "1EaWG4FO4eW8qrqcvnQoWzdsSYM9R4Y8N"

    // 1. Find the master sheet file in Google Drive.
    const masterResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q='${folderId}' in parents and trashed=false and mimeType='application/vnd.google-apps.spreadsheet'&fields=files(id,name)`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    )

    if (masterResponse.ok) {
      const masterData = await masterResponse.json()
      const masterFile = masterData.files.find((file: any) => file.name.toLowerCase().includes("master"))

      if (masterFile) {
        console.log("[v0] Found master sheet:", masterFile.name)

        // 2. Fetch the entire content of the master sheet.
        const masterSheetResponse = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${masterFile.id}/values/Sheet1!A1:Z1000`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        )

        if (masterSheetResponse.ok) {
          const masterSheetData = await masterSheetResponse.json()
          const masterRows = masterSheetData.values || []

          // 3. Find the row index of the current college by name.
          const collegeRowIndex = masterRows.findIndex(
            (row: any[], index: number) =>
              index > 0 &&
              row[3] &&
              row[4] &&
              (row[4].toString().toLowerCase() + " - " + row[3].toString().toLowerCase()).includes(collegeName.toLowerCase())
          );

          if (collegeRowIndex !== -1) {
            const rowNumber = collegeRowIndex + 1
            console.log("[v0] Updating master sheet row:", rowNumber)

            const currentRow = masterRows[collegeRowIndex]
            const currentTotalSessions = Number.parseInt(currentRow[6]) || 0 // Corrected column for Total Sessions
            const currentTotalTests = Number.parseInt(currentRow[7]) || 0      // Corrected column for Total Tests

            // 4. Calculate the new total sessions. Only increment if it's a new session.
            const newTotalSessions = newSession ? currentTotalSessions + 1 : currentTotalSessions;

            // 5. Send a PUT request to update the values in columns G and H.
            await fetch(
              `https://sheets.googleapis.com/v4/spreadsheets/${masterFile.id}/values/Sheet1!G${rowNumber}:H${rowNumber}?valueInputOption=RAW`,
              {
                method: "PUT",
                headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                  values: [[newTotalSessions, currentTotalTests]],
                }),
              },
            )
            console.log("[v0] Master sheet updated successfully")
          } else {
            console.log("[v0] College not found in master sheet:", collegeName)
          }
        }
      } else {
        console.log("[v0] Master sheet not found")
      }
    }
  } catch (error) {
    console.error("[v0] Error updating master sheet:", error)
  }
}

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Mark Attendance
          </CardTitle>
          <CardDescription>Select college, date, and mark student attendance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label>College</Label>
              <Select
                value={selectedCollege}
                onValueChange={(value) => {
                  setSelectedCollege(value)
                  setDataFetched(false)
                  setStudents([])
                  setSuccess(false);
                }}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loading ? "Loading colleges..." : "Select college"} />
                </SelectTrigger>
                <SelectContent>
                  {colleges.map((college) => (
                    <SelectItem key={college} value={college}>
                      {college}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Date</Label>
              <DatePicker
                selected={selectedDate}
                onChange={(date: Date | null) => {
  setSelectedDate(date || undefined)
  setSuccess(false); // New line: Resets the success state
}}
                dateFormat="P"
                className="react-datepicker-input"
              />
            </div>

            <div className="space-y-2">
              <Label>Branch Filter</Label>
              <Select value={selectedBranch} onValueChange={setBranch}>
                <SelectTrigger>
                  <SelectValue placeholder="All branches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All branches</SelectItem>
                  {branches.map((branch) => (
                    <SelectItem key={branch} value={branch}>
                      {branch}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedCollege && (
            <div className="mt-4">
              <Button onClick={fetchStudentData} disabled={fetching} className="w-full">
                {fetching ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Fetching Data...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Fetch Student Data
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {dataFetched && selectedCollege && (
        <Card>
          <CardHeader>
            <CardTitle>Student List - {selectedDate ? format(selectedDate, "dd/MM/yyyy") : "Select a date"}</CardTitle>
            <CardDescription>Mark attendance for {filteredStudents.length} students</CardDescription>
          </CardHeader>
          <CardContent>
            {success && (
              <Alert className="mb-4 border-green-200 bg-green-50">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <AlertDescription className="text-green-800">Attendance saved successfully!</AlertDescription>
              </Alert>
            )}

            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>S.No</TableHead>
                    <TableHead>Reg. No</TableHead>
                    <TableHead>Student Name</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead className="text-center">Sessions</TableHead>
                    <TableHead className="text-center">Attended</TableHead>
                    <TableHead className="text-center">Present</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((student) => (
                    <TableRow key={student.sno}>
                      <TableCell>{student.sno}</TableCell>
                      <TableCell className="font-mono">{student.regNo}</TableCell>
                      <TableCell className="font-medium">{student.name}</TableCell>
                      <TableCell>{student.branch}</TableCell>
                      <TableCell className="text-center">{student.totalSessions}</TableCell>
                      <TableCell className="text-center">{student.totalAttended}</TableCell>
                      <TableCell className="text-center">
                        <Checkbox checked={student.present} onCheckedChange={() => handleStudentToggle(student.sno)} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="instructor-name">Instructor Name *</Label>
                  <Input
                    id="instructor-name"
                    value={instructorName}
                    onChange={(e) => setInstructorName(e.target.value)}
                    placeholder="Enter your name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="instructor-email">Email *</Label>
                  <Input id="instructor-email" type="email" value={userEmail} readOnly className="bg-muted" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="instructor-mobile">Mobile *</Label>
                  <Input
                    id="instructor-mobile"
                    value={instructorMobile}
                    onChange={(e) => setInstructorMobile(e.target.value)}
                    placeholder="Enter mobile number"
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Saving Attendance...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Attendance
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}