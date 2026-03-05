"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { studentsApi } from "@/lib/api";
import { StudentForm } from "@/components/students/StudentForm";
import { ImportDialog } from "@/components/shared/ImportDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Upload, UserPlus, FileSpreadsheet } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export default function CreateStudentPage({
  params: { lang },
}: {
  params: { lang: string };
}) {
  const [importOpen, setImportOpen] = useState(false);
  const queryClient = useQueryClient();

  // Create Single Mutation
  const createMutation = useMutation({
    mutationFn: studentsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
  });

  // Bulk Import Mutation
  const bulkImportMutation = useMutation({
    mutationFn: async (studentsData: any[]) => {
      return await Promise.allSettled(
        studentsData.map((student) => studentsApi.create(student))
      );
    },
    onSuccess: (results) => {
      const successful = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;
      if (successful > 0) toast.success(`Imported ${successful} students`);
      if (failed > 0) toast.error(`Failed to import ${failed} students`);
      queryClient.invalidateQueries({ queryKey: ["students"] });
      setImportOpen(false);
    },
  });

  const handleImport = (data: any[]) => {
    const transformedData = data.map((row) => ({
      fullName: row["Full Name"] || row.fullName || row.name,
      studentNo: row["Student Number"] || row.studentNo || row.studentNumber,
      group: row.group || row.Group,
      email: row.email || row.Email,
    }));
    bulkImportMutation.mutate(transformedData);
  };

  const dict = {
    common: { save: "Create Student", cancel: "Cancel", loading: "Saving..." },
    students: {
      createTitle: "Add New Student",
      importTitle: "Bulk Import",
      importDescription: "Upload your CSV/XLSX file to add multiple students at once.",
    }
  };

  return (
    <div className="container space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link 
          href={`/${lang}/dashboard/students`}
          className="group flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Back to Students
        </Link>
      </div>

      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">{dict.students.createTitle}</h1>
          <p className="text-muted-foreground text-sm">
            Enter details manually or use the import feature for bulk registration.
          </p>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 gap-6">
          {/* Main Form Card */}
          <Card className="border-none shadow-sm ring-1 ring-muted">
            <CardContent className="p-8">
              <div className="flex items-center gap-3 mb-8 text-primary">
                <UserPlus className="h-5 w-5" />
                <h2 className="font-semibold italic uppercase tracking-widest text-xs">Individual Entry</h2>
              </div>
              
              <StudentForm
                lang={lang}
                dict={dict}
                onSubmit={async (data) => {
                  await createMutation.mutateAsync(data);
                  toast.success("Student created successfully");
                }}
              />
            </CardContent>
          </Card>

          {/* Minimalist Import Section */}
          <div className="rounded-2xl border-2 border-dashed border-muted p-8 transition-colors hover:border-primary/20 hover:bg-muted/10">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="p-3 rounded-full bg-primary/5 text-primary">
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-medium">Have a list of students?</h3>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Quickly upload your data using our CSV template.
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setImportOpen(true)}
                className="bg-background"
              >
                <Upload className="mr-2 h-4 w-4" />
                {dict.students.importTitle}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={handleImport}
        title={dict.students.importTitle}
        description={dict.students.importDescription}
        templateColumns={["Full Name", "Student Number", "Group", "Email"]}
        isGroupedColumns={true}
      />
    </div>
  );
} 