"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ClipboardCheck, Save, CheckCircle, Download, Loader2 } from "lucide-react"
import { format } from "date-fns"

interface Student {
  sno: number
  regNo: string
  name: string
  branch: string
  totalTests: number
  testsAttended: number
  currentScore: string
}

interface TestMarkingProps {
  userEmail: string
  isAuthenticated: boolean
}

export function TestMarking({ userEmail, isAuthenticated }: TestMarkingProps) {
  const [selectedCollege, setSelectedCollege] = useState("")
  const [testName, setTestName] = useState("")
  const [maxMarks, setMaxMarks] = useState("")
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
    if (!selectedCollege) {
      alert("Please select a college first")
      return
    }
    if (!testName) {
        alert("Please enter a Test Name first.")
        return
    }

    setFetching(true)
    setSuccess(false)
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
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetFile.id}/values/Test!A1:Z1000`,
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
            
            // Find the index of the column for the specified test name
            const testColumnIndex = headerRow.findIndex((header: string) => header.trim() === testName.trim());


            const studentDataRows = allRows.slice(4) // Student data starts from row 5 (index 4)

            const studentData: Student[] = studentDataRows
              .filter((row: any[]) => row[0] && row[5] && row[6]) // Filter out empty rows
              .map((row: any[], index: number) => {
                const totalTests = Number.parseInt(row[7]) || 0
                const testsAttended = Number.parseInt(row[8]) || 0
                
                // Get the existing score if the column was found
                const existingScore = testColumnIndex !== -1 && row[testColumnIndex] ? row[testColumnIndex] : "";

                return {
                  sno: Number.parseInt(row[0]) || index + 1,
                  regNo: row[5] || "",
                  name: row[6] || "",
                  branch: row[4] || "",
                  totalTests: totalTests,
                  testsAttended: testsAttended,
                  currentScore: existingScore, // Set the existing score
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

  const handleScoreChange = (sno: number, score: string) => {
    setStudents((prev) => prev.map((student) => (student.sno === sno ? { ...student, currentScore: score } : student)))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCollege || !testName || !maxMarks || !instructorName || !userEmail || !instructorMobile || !sheetFileId) {
      alert("Please ensure all fields are filled and student data is fetched.")
      return
    }

    const hasInvalidScores = students.some((student) => {
      const score = Number.parseFloat(student.currentScore)
      return student.currentScore && (isNaN(score) || score < 0 || score > Number.parseFloat(maxMarks))
    })

    if (hasInvalidScores) {
      alert(`Please enter valid scores between 0 and ${maxMarks}`)
      return
    }

    setSaving(true)
    setSuccess(false)

    try {
      const authData = localStorage.getItem("googleAuth")
      if (!authData) return
      const { accessToken } = JSON.parse(authData)

      // Fetch the most current data to determine isNewTest
      const allSheetDataResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetFileId}/values/Test!A1:Z1000`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      )
      const allSheetData = await allSheetDataResponse.json()
      const headerRow = allSheetData.values[3] || []

      let testColumnIndex = headerRow.findIndex((header: string) => header.trim() === testName.trim())
      const isNewTest = testColumnIndex === -1

      if (isNewTest) {
        testColumnIndex = headerRow.length
      }

      const columnLetter = String.fromCharCode(65 + testColumnIndex)

      const requests = []

      // Request to add the header data
      requests.push({
        range: `Test!${columnLetter}1:${columnLetter}4`,
        values: [
          [`${instructorName}`],
          [`${userEmail}`],
          [`${instructorMobile}`],
          [`${testName}`],
        ],
      })

      // Separate requests for scores and test count updates
      const scoreUpdates = filteredStudents.map((student) => ({
        range: `Test!${columnLetter}${student.sno + 4}`,
        values: [[student.currentScore || ""]],
      }))

      const testCountUpdates = filteredStudents.map((student) => {
        const studentRowNumber = student.sno + 4
        
        let newTotalTests = student.totalTests;
        let newTestsAttended = student.testsAttended;

        // If it's a new test, increment both counts
        if (isNewTest) {
          newTotalTests = student.totalTests + 1;
          if (student.currentScore) {
            newTestsAttended = student.testsAttended + 1;
          }
        } 
        // If it's an existing test and a score is entered, and the student wasn't previously marked, increment attended count
        else if (student.currentScore) {
            const previousScore = allSheetData.values[studentRowNumber - 1]?.[testColumnIndex];
            if (!previousScore) {
                newTestsAttended = student.testsAttended + 1;
            }
        }

        return {
          range: `Test!H${studentRowNumber}:I${studentRowNumber}`,
          values: [[newTotalTests, newTestsAttended]],
        }
      })
      
      requests.push(...scoreUpdates, ...testCountUpdates)

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

      await updateMasterSheet(accessToken, selectedCollege, isNewTest)

      setSaving(false)
      setSuccess(true)
      setDataFetched(false)
      setTestName("")
      setMaxMarks("")
    } catch (error) {
      console.error("[v0] Error saving test marks:", error)
      setSaving(false)
      setSuccess(false)
    }
  }

  const updateMasterSheet = async (
    accessToken: string,
    collegeName: string,
    newTest: boolean,
  ) => {
    try {
      const folderId = "1EaWG4FO4eW8qrqcvnQoWzdsSYM9R4Y8N"

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

          const masterSheetResponse = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${masterFile.id}/values/Sheet1!A1:Z1000`,
            { headers: { Authorization: `Bearer ${accessToken}` } },
          )

          if (masterSheetResponse.ok) {
            const masterSheetData = await masterSheetResponse.json()
            const masterRows = masterSheetData.values || []

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
              const currentTotalSessions = Number.parseInt(currentRow[6]) || 0 
              const currentTotalTests = Number.parseInt(currentRow[7]) || 0
              const newTotalTests = newTest ? currentTotalTests + 1 : currentTotalTests;

              await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${masterFile.id}/values/Sheet1!G${rowNumber}:H${rowNumber}?valueInputOption=RAW`,
                {
                  method: "PUT",
                  headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
                  body: JSON.stringify({
                    values: [[currentTotalSessions, newTotalTests]],
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

  if (!isAuthenticated) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Please sign in with Google to mark test scores.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5" />
            Test Mark Entry
          </CardTitle>
          <CardDescription>Enter test marks for students</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
              <Label htmlFor="test-name">Test Name</Label>
              <Input
                id="test-name"
                value={testName}
                onChange={(e) => {
  setTestName(e.target.value);
  setSuccess(false); // New line: Resets the success state
}}
                placeholder="e.g., Mid Term Exam"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="max-marks">Max Marks</Label>
              <Input
                id="max-marks"
                type="number"
                value={maxMarks}
                onChange={(e) => {
  setMaxMarks(e.target.value);
  setSuccess(false); // New line: Resets the success state
}}
                placeholder="e.g., 100"
                min="1"
                required
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
            <CardTitle>Enter Marks - {testName || "Select a test"}</CardTitle>
            <CardDescription>
              Maximum marks: {maxMarks || "-"} | Students: {filteredStudents.length}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {success && (
              <Alert className="mb-4 border-green-200 bg-green-50">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <AlertDescription className="text-green-800">Test marks saved successfully!</AlertDescription>
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
                    <TableHead className="text-center">Total Tests</TableHead>
                    <TableHead className="text-center">Attended</TableHead>
                    <TableHead className="text-center">Marks (/{maxMarks})</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((student) => (
                    <TableRow key={student.sno}>
                      <TableCell>{student.sno}</TableCell>
                      <TableCell className="font-mono">{student.regNo}</TableCell>
                      <TableCell className="font-medium">{student.name}</TableCell>
                      <TableCell>{student.branch}</TableCell>
                      <TableCell className="text-center">{student.totalTests}</TableCell>
                      <TableCell className="text-center">{student.testsAttended}</TableCell>
                      <TableCell className="text-center">
                        <Input
                          type="number"
                          value={student.currentScore}
                          onChange={(e) => handleScoreChange(student.sno, e.target.value)}
                          placeholder="0"
                          min="0"
                          max={maxMarks}
                          className="w-20 text-center"
                        />
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
                    Saving Test Marks...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Test Marks
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