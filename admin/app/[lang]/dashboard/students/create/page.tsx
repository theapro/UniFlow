"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { groupsApi, studentsApi } from "@/lib/api";
import { StudentForm } from "@/components/students/StudentForm";
import { ImportDialog } from "@/components/shared/ImportDialog";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Upload } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export default function CreateStudentPage({
  params: { lang },
}: {
  params: { lang: string };
}) {
  const [importOpen, setImportOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: groupsResp } = useQuery({
    queryKey: ["groups"],
    queryFn: () => groupsApi.list({ take: 200 }),
  });

  const groups = Array.isArray(groupsResp?.data?.data)
    ? groupsResp.data.data
    : [];

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
        studentsData.map((student) => studentsApi.create(student)),
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
    const transformedData = data
      .map((row, idx) => {
        const fullName = row["Full Name"] || row.fullName || row.name;
        const studentNo =
          row["Student Number"] || row.studentNo || row.studentNumber;
        const groupName = row.group || row.Group;
        const email = row.email || row.Email;

        const group = groupName
          ? groups.find(
              (g: any) =>
                String(g.name).trim().toLowerCase() ===
                String(groupName).trim().toLowerCase(),
            )
          : null;

        return {
          __row: idx + 1,
          fullName,
          studentNo,
          email,
          groupId: group?.id ?? null,
          groupName: groupName ?? null,
        };
      })
      .filter((x) => {
        const ok =
          typeof x.fullName === "string" &&
          x.fullName.trim() &&
          typeof x.email === "string" &&
          x.email.trim() &&
          typeof x.groupId === "string" &&
          x.groupId;
        return Boolean(ok);
      });

    const skipped = data.length - transformedData.length;
    if (skipped > 0) {
      toast.error(
        `${skipped} rows skipped (missing fullName/email or unknown group name).`,
      );
    }
    if (transformedData.length === 0) return;
    bulkImportMutation.mutate(transformedData);
  };

  const dict = {
    common: { save: "Create Student", cancel: "Cancel", loading: "Saving..." },
    students: {
      createTitle: "Add New Student",
      importTitle: "Bulk Import",
      importDescription:
        "Upload your CSV/XLSX file to add multiple students at once.",
    },
  };

  return (
    <div className="container max-w-7xl py-10 space-y-12">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href={`/${lang}/dashboard/students`}
          className="group flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Back to Students
        </Link>

        <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
          <Upload className="mr-2 h-4 w-4" />
          {dict.students.importTitle}
        </Button>
      </div>

      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {dict.students.createTitle}
          </h1>
          <p className="text-muted-foreground text-sm">
            Enter details manually or use the import feature for bulk
            registration.
          </p>
        </div>

        <StudentForm
          lang={lang}
          dict={dict}
          groups={groups}
          onSubmit={async (data) => {
            await createMutation.mutateAsync(data);
            toast.success("Student created successfully");
          }}
        />
      </div>

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={handleImport}
        title={dict.students.importTitle}
        description={dict.students.importDescription}
        templateColumns={["Full Name", "Student Number", "Group", "Email"]}
        isGroupedColumns={false}
      />
    </div>
  );
}
