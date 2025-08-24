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

interface College {
  name: string;
  id: string;
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
  const [colleges, setColleges] = useState<College[]>([])
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [dataFetched, setDataFetched] = useState(false)
  const [sheetFileId, setSheetFileId] = useState<string>("")
  const [searchQuery, setSearchQuery] = useState("")
  const [branches, setBranches] = useState<string[]>([])

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

      const masterResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files?q='${folderId}' in parents and name contains 'Master' and mimeType='application/vnd.google-apps.spreadsheet'&fields=files(id,name)`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      )

      if (!masterResponse.ok) {
        throw new Error("Failed to find master sheet.")
      }

      const masterData = await masterResponse.json()
      const masterFile = masterData.files[0]

      if (masterFile) {
        const sheetDataResponse = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${masterFile.id}/values/Sheet1!A2:I`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        )

        if (sheetDataResponse.ok) {
          const sheetData = await sheetDataResponse.json()
          const collegeList: College[] = (sheetData.values || []).map((row: any[]) => {
            const sheetUrl = row[8]
            const sheetId = sheetUrl ? sheetUrl.split('/d/')[1].split('/')[0] : null
            return {
              name: `${row[4]} - ${row[3]}`,
              id: sheetId
            }
          }).filter((college: College) => college.id)

          setColleges(collegeList)
        }
      }
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error("[v0] Error fetching college files:", error.message);
        } else {
            console.error("[v0] An unknown error occurred:", error);
        }
    } finally {
      setLoading(false)
    }
  }

  const fetchStudentData = async () => {
    const selectedCollegeObject = colleges.find(c => c.name === selectedCollege);
    if (!selectedCollegeObject || !selectedDate) {
        alert("Please select a college and a date first");
        return;
    }

    setFetching(true);
    setStudents([]);
    setBranches([]);

    try {
        const authData = localStorage.getItem("googleAuth");
        if (!authData) return;
        const { accessToken } = JSON.parse(authData);
        
        const sheetFileId = selectedCollegeObject.id;

        const allDataResponse = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetFileId}/values/Attendance!A1:Z1000`,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            },
        );

        if (!allDataResponse.ok) {
            const errorResponseText = await allDataResponse.text();
            console.error("API Response Error:", errorResponseText);
            throw new Error(`Failed to fetch student data: ${allDataResponse.statusText}`);
        }

        const allSheetData = await allDataResponse.json();
        const allRows = allSheetData.values || [];
        const headerRow = allRows[3] || [];
        const studentDataRows = allRows.slice(4);

        const dateColumn = format(selectedDate, "dd/MM/yyyy");
        const dateColumnIndex = headerRow.findIndex((header: string) => header.trim() === dateColumn.trim());

        const uniqueBranches = new Set<string>();

        const studentData: Student[] = studentDataRows
            .filter((row: any[]) => row[0] && row[5] && row[6])
            .map((row: any[], index: number) => {
                const isPresent = dateColumnIndex !== -1 && row[dateColumnIndex] === "P";
                const studentBranch = row[4] || "";
                uniqueBranches.add(studentBranch);

                return {
                    sno: Number.parseInt(row[0]) || index + 1,
                    regNo: row[5] || "",
                    name: row[6] || "",
                    branch: studentBranch,
                    district: row[1] || "",
                    collegeType: row[2] || "",
                    totalSessions: Number.parseInt(row[7]) || 0,
                    totalAttended: Number.parseInt(row[8]) || 0,
                    present: isPresent,
                };
            });

        setStudents(studentData);
        setBranches(Array.from(uniqueBranches).sort());
        setDataFetched(true);
        setSheetFileId(sheetFileId);
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error("[v0] Error fetching student data:", error.message);
            alert(`Failed to fetch student data. Please check the college sheet link and API permissions. Error: ${error.message}`);
        } else {
            console.error("[v0] An unknown error occurred:", error);
            alert("An unknown error occurred while fetching student data.");
        }
    } finally {
        setFetching(false);
    }
  };

  const filteredStudents =
    selectedBranch && selectedBranch !== "all"
      ? students.filter((student) => student.branch === selectedBranch)
      : students

  const handleStudentToggle = (sno: number) => {
    setStudents((prev) =>
      prev.map((student) => {
        if (student.sno === sno) {
          //if (student.present) {
            //alert("Attendance is already marked as 'Present' and cannot be changed to 'Absent'.")
            //return student
          //}
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

      requests.push({
        range: `Attendance!${columnLetter}1:${columnLetter}4`,
        values: [
          [`${instructorName}`],
          [`${userEmail}`],
          [`${instructorMobile}`],
          [`${dateColumn}`],
        ],
      })

      const attendanceUpdates = filteredStudents.map((student) => ({
        range: `Attendance!${columnLetter}${student.sno + 4}`,
        values: [[student.present ? "P" : "A"]],
      }))

      const sessionUpdates = filteredStudents.map((student) => {
        const studentRowNumber = student.sno + 4
        
        let newTotalSessions = student.totalSessions;
        let newTotalAttended = student.totalAttended;

        if (isNewSession) {
          newTotalSessions = student.totalSessions + 1;
          if (student.present) {
            newTotalAttended = student.totalAttended + 1;
          }
        } else {
            const previousAttendanceStatus = allSheetData.values[studentRowNumber - 1]?.[dateColumnIndex];
            if (previousAttendanceStatus !== "P" && student.present) {
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
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error("[v0] Error saving attendance:", error.message);
      } else {
        console.error("[v0] An unknown error occurred:", error);
      }
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

            const newTotalSessions = newSession ? currentTotalSessions + 1 : currentTotalSessions;

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
  } catch (error: unknown) {
      if (error instanceof Error) {
        console.error("[v0] Error updating master sheet:", error.message);
      } else {
        console.error("[v0] An unknown error occurred:", error);
      }
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
      setBranch("all")
      setSuccess(false);
      setSearchQuery("");
    }}
    onOpenChange={(isOpen) => {
    // Reset state only when the dropdown is opened
    if (isOpen) {
      setSearchQuery("");
      setSelectedCollege("");
    }
  }}
    disabled={loading}
  >
    <SelectTrigger className="w-full">
      <SelectValue placeholder={loading ? "Loading colleges..." : "Select college"} />
    </SelectTrigger>
    <SelectContent className="bg-popover text-popover-foreground">
      <div className="px-2 py-1 sticky top-0 bg-popover border-b" style={{ zIndex: 10 }}>
        <Input
          placeholder="Search colleges..."
          value={searchQuery}
          onChange={(e) => {
            e.stopPropagation();
            setSearchQuery(e.target.value);
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.stopPropagation();
          }}
          className="h-8 bg-background"
          autoFocus={false}
        />
      </div>
      {colleges
        .filter((college: College) => college.name.toLowerCase().includes(searchQuery.toLowerCase()))
        .map((college) => (
          <SelectItem key={college.id} value={college.name}>
            {college.name}
          </SelectItem>
        ))}
      {colleges.filter((college: College) => college.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
        <div className="px-2 py-1 text-sm text-muted-foreground">
          No colleges found
        </div>
      )}
    </SelectContent>
  </Select>
</div>

            <div className="space-y-2">
              <Label>Date</Label>
              <DatePicker
                selected={selectedDate}
                onChange={(date: Date | null) => {
                  setSelectedDate(date || undefined)
                  setSuccess(false);
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
