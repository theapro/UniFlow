"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { studentsApi } from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StudentTable } from "@/components/students/StudentTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { ImportDialog } from "@/components/shared/ImportDialog";
import { Plus, Users, Search, Upload } from "lucide-react";
import { toast } from "sonner";

export default function StudentsPage({
  params: { lang },
}: {
  params: { lang: string };
}) {
  const [search, setSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["students", search],
    queryFn: () => studentsApi.list({ q: search }).then((res) => res.data.data),
  });

  const bulkImportMutation = useMutation({
    mutationFn: async (studentsData: any[]) => {
      const results = await Promise.allSettled(
        studentsData.map((student) => studentsApi.create(student)),
      );
      return results;
    },
    onSuccess: (results) => {
      const successful = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;

      if (successful > 0) {
        toast.success(`Successfully imported ${successful} student(s)`);
      }
      if (failed > 0) {
        toast.error(`Failed to import ${failed} student(s)`);
      }

      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
  });

  const handleImport = (data: any[]) => {
    // Check if data is already transformed (from grouped columns format)
    const isAlreadyTransformed =
      data.length > 0 &&
      "studentNo" in data[0] &&
      "fullName" in data[0] &&
      "group" in data[0];

    // Transform the data to match API format
    const transformedData = isAlreadyTransformed
      ? data
      : data.map((row) => ({
          fullName: row["Full Name"] || row.fullName || row.name,
          studentNo:
            row["Student Number"] || row.studentNo || row.studentNumber,
          group: row.group || row.Group,
          email: row.email || row.Email,
          phone: row.phone || row.Phone,
        }));

    bulkImportMutation.mutate(transformedData);
  };

  const dict = {
    common: {
      search: "Search",
      create: "Create",
      delete: "Delete",
      cancel: "Cancel",
      actions: "Actions",
      import: "Import",
    },
    students: {
      title: "Students",
      fullName: "Full Name",
      studentNo: "Student Number",
      group: "Group",
      deleteConfirm: "Are you sure you want to delete this student?",
      importTitle: "Import Students",
      importDescription: "Upload a CSV or XLSX file with student data",
    },
  };

  return (
    <div className="container max-w-7xl py-10 space-y-12">
      <PageHeader
        title={dict.students.title}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              {dict.common.import}
            </Button>
            <Link href={`/${lang}/dashboard/students/create`}>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                {dict.common.create}
              </Button>
            </Link>
          </div>
        }
      />

      <div className="rounded-[32px] border border-border/40 bg-muted/10 p-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={dict.common.search}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 rounded-2xl border-border/40 bg-background/50 pl-10"
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div>Loading...</div>
      ) : data && data.length > 0 ? (
        <StudentTable students={data} lang={lang} dict={dict} />
      ) : (
        <EmptyState
          icon={Users}
          title="No students found"
          description="Get started by creating a new student"
          action={
            <Link href={`/${lang}/dashboard/students/create`}>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                {dict.common.create}
              </Button>
            </Link>
          }
        />
      )}

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={handleImport}
        title={dict.students.importTitle}
        description={dict.students.importDescription}
        templateColumns={[
          "Full Name",
          "Student Number",
          "Group",
          "Email",
          "Phone",
        ]}
        isGroupedColumns={true}
      />
    </div>
  );
}
