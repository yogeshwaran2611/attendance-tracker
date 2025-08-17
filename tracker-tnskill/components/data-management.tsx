"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ExternalLink, Search, RefreshCw } from "lucide-react"

interface MasterSheetData {
  district: string
  collegeType: string
  collegeCode: string
  collegeName: string
  totalStudents: number
  totalSessions: number
  totalTests: number
  googleSheetLink: string
  addedBy: string
}

export function DataManagement() {
  const [data, setData] = useState<MasterSheetData[]>([])
  const [filteredData, setFilteredData] = useState<MasterSheetData[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    fetchSheetsData()
  }, [])

  const fetchSheetsData = async () => {
    setLoading(true)
    setError("")
    try {
      const authData = localStorage.getItem("googleAuth")
      if (!authData) {
        setError("Please authenticate with Google first")
        setData([])
        setFilteredData([])
        return
      }

      const { accessToken } = JSON.parse(authData)
      const folderId = "1EaWG4FO4eW8qrqcvnQoWzdsSYM9R4Y8N"

      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&fields=files(id,name,createdTime,size,webViewLink)`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      )

      if (!response.ok) {
        throw new Error(`Google Drive API error: ${response.status}`)
      }

      const result = await response.json()
      const sheets =
        result.files?.filter(
          (file: any) =>
            file.name.includes("Google Sheets") || file.name.endsWith(".xlsx") || file.name.includes("Master"),
        ) || []

      console.log("[v0] Fetched sheets:", sheets.length)

      const masterData: MasterSheetData[] = []

      for (const sheet of sheets) {
        if (sheet.name.toLowerCase().includes("master")) {
          // Fetch master sheet data
          try {
            const sheetResponse = await fetch(
              `https://sheets.googleapis.com/v4/spreadsheets/${sheet.id}/values/Sheet1!A:J`,
              {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                },
              },
            )

            if (sheetResponse.ok) {
              const sheetData = await sheetResponse.json()
              const rows = sheetData.values || []

              // Skip header row and process data
              for (let i = 1; i < rows.length; i++) {
                const row = rows[i]
                if (row.length >= 9) {
                  masterData.push({
                    district: row[1] || "",
                    collegeType: row[2] || "",
                    collegeCode: row[3] || "",
                    collegeName: row[4] || "",
                    totalStudents: Number.parseInt(row[5]) || 0,
                    totalSessions: Number.parseInt(row[6]) || 0,
                    totalTests: Number.parseInt(row[7]) || 0,
                    googleSheetLink: row[8] || sheet.webViewLink,
                    addedBy: row[9] || "Unknown",
                  })
                }
              }
            }
          } catch (sheetError) {
            console.error("[v0] Error fetching sheet data:", sheetError)
          }
        }
      }

      setData(masterData)
      setFilteredData(masterData)
      console.log("[v0] Master data loaded:", masterData.length)
    } catch (error) {
      console.error("[v0] Error fetching sheets data:", error)
      setError(`Failed to fetch data from Google Drive: ${error instanceof Error ? error.message : "Unknown error"}`)
      setData([])
      setFilteredData([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const filtered = data.filter(
      (item) =>
        item.collegeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.district.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.collegeCode.toLowerCase().includes(searchTerm.toLowerCase()),
    )
    setFilteredData(filtered)
  }, [searchTerm, data])

  const handleRefresh = () => {
    fetchSheetsData()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Master Sheet Data
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </CardTitle>
        <CardDescription>View and manage all college data from uploaded Google Sheets</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-2 mb-4">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by college name, district, or code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>District</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>College Name</TableHead>
                <TableHead className="text-right">Students</TableHead>
                <TableHead className="text-right">Sessions</TableHead>
                <TableHead className="text-right">Tests</TableHead>
                <TableHead>Added By</TableHead>
                <TableHead>Sheet Link</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((item, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{item.district}</TableCell>
                  <TableCell>{item.collegeType}</TableCell>
                  <TableCell>{item.collegeCode}</TableCell>
                  <TableCell>{item.collegeName}</TableCell>
                  <TableCell className="text-right">{item.totalStudents}</TableCell>
                  <TableCell className="text-right">{item.totalSessions}</TableCell>
                  <TableCell className="text-right">{item.totalTests}</TableCell>
                  <TableCell>{item.addedBy}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" asChild>
                      <a href={item.googleSheetLink} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {filteredData.length === 0 && !loading && (
          <div className="text-center py-8 text-muted-foreground">
            {data.length === 0
              ? "No files uploaded yet. Upload Excel files to see data here."
              : "No data found matching your search criteria."}
          </div>
        )}

        {loading && <div className="text-center py-8 text-muted-foreground">Loading data from Google Drive...</div>}
      </CardContent>
    </Card>
  )
}
