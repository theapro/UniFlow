"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Upload, FileSpreadsheet, FileText } from "lucide-react";
import * as XLSX from "xlsx";
import Papa from "papaparse";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (data: any[]) => void;
  title: string;
  description?: string;
  templateColumns: string[];
  isGroupedColumns?: boolean; // For special format like Employability sheet
  parseFile?: (file: File) => Promise<any[]>;
}

export function ImportDialog({
  open,
  onOpenChange,
  onImport,
  title,
  description,
  templateColumns,
  isGroupedColumns = false,
  parseFile,
}: ImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const ext = selectedFile.name.split(".").pop()?.toLowerCase();
      if (ext === "csv" || ext === "xlsx" || ext === "xls") {
        setFile(selectedFile);
        setError(null);
      } else {
        setError("Please select a CSV or XLSX file");
        setFile(null);
      }
    }
  };

  const parseCSV = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        complete: (results) => {
          resolve(results.data);
        },
        error: (error) => {
          reject(error);
        },
      });
    });
  };

  const parseExcel = async (file: File): Promise<any[]> => {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    return jsonData;
  };

  const parseGroupedColumns = (rawData: any[]): any[] => {
    // This handles the special format where groups are in columns
    // Row 0: Completely empty
    // Row 1: Empty cells then group names (Employability 19/20/21, etc.)
    // Row 2+: Empty cell, then Student IDs and names under each group

    if (rawData.length < 3) return [];

    const students: any[] = [];

    // Get all column keys from the first data row
    const columns = Object.keys(rawData[0]);

    // Find group headers (they appear in row 1, index 1)
    const groupColumns: { startCol: number; groupName: string }[] = [];

    // Second row (index 1) contains group names
    const headerRow = rawData[1];
    columns.forEach((col, index) => {
      const value = headerRow[col];
      if (value && typeof value === "string" && value.trim().length > 0) {
        groupColumns.push({ startCol: index, groupName: value.trim() });
      }
    });

    console.log("Found groups:", groupColumns);

    // Process each row starting from row 2 (index 2)
    for (let rowIndex = 2; rowIndex < rawData.length; rowIndex++) {
      const row = rawData[rowIndex];

      // For each group, extract student ID and name
      groupColumns.forEach(({ startCol, groupName }) => {
        const studentIdCol = columns[startCol];
        const studentNameCol = columns[startCol + 1];

        const studentId = row[studentIdCol];
        const studentName = row[studentNameCol];

        // Only add if both ID and name exist
        if (
          studentId &&
          studentName &&
          String(studentId).trim() !== "" &&
          String(studentName).trim() !== ""
        ) {
          students.push({
            studentNo: String(studentId).trim(),
            fullName: String(studentName).trim(),
            group: groupName.trim(),
          });
        }
      });
    }

    console.log("Parsed students:", students.length);
    return students;
  };

  const handleImport = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      let data: any[] = [];

      if (parseFile) {
        data = await parseFile(file);
      } else {
        const ext = file.name.split(".").pop()?.toLowerCase();

        if (ext === "csv") {
          // Parse CSV without header for grouped columns format
          if (isGroupedColumns) {
            const rawData = await new Promise<any[]>((resolve, reject) => {
              Papa.parse(file, {
                header: false,
                skipEmptyLines: false,
                complete: (results) => {
                  // Convert array of arrays to array of objects with column indices
                  const rows = results.data as any[][];
                  const converted = rows.map((row: any[]) => {
                    const obj: any = {};
                    row.forEach((cell, index) => {
                      obj[`col${index}`] = cell;
                    });
                    return obj;
                  });
                  resolve(converted);
                },
                error: (error) => {
                  reject(error);
                },
              });
            });
            data = parseGroupedColumns(rawData);
          } else {
            data = await parseCSV(file);
          }
        } else if (ext === "xlsx" || ext === "xls") {
          const rawData = await parseExcel(file);
          if (isGroupedColumns) {
            data = parseGroupedColumns(rawData);
          } else {
            data = rawData;
          }
        }
      }

      // Filter out empty rows (only for non-grouped format)
      if (!isGroupedColumns && !parseFile) {
        data = data.filter((row) => Object.values(row).some((val) => val));
      }

      if (data.length === 0) {
        setError("No data found in file");
        return;
      }

      onImport(data);
      onOpenChange(false);
      setFile(null);
    } catch (err) {
      setError("Failed to parse file. Please check the format.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const csvContent = templateColumns.join(",") + "\n";
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "template.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-4">
          {templateColumns.length > 0 && (
            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadTemplate}
                className="w-full"
              >
                <FileText className="mr-2 h-4 w-4" />
                Download Template
              </Button>
            </div>
          )}

          <div>
            <label
              htmlFor="file-upload"
              className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-accent"
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                {file ? (
                  <>
                    <FileSpreadsheet className="w-8 h-8 mb-2 text-primary" />
                    <p className="text-sm text-muted-foreground">{file.name}</p>
                  </>
                ) : (
                  <>
                    <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Click to upload CSV or XLSX
                    </p>
                  </>
                )}
              </div>
              <Input
                id="file-upload"
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setFile(null);
              setError(null);
            }}
          >
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={!file || loading}>
            {loading ? "Importing..." : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
