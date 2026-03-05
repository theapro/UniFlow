"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { teachersApi } from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TeacherTable } from "@/components/teachers/TeacherTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { ImportDialog } from "@/components/shared/ImportDialog";
import { Plus, GraduationCap, Search, Upload } from "lucide-react";
import { toast } from "sonner";

export default function TeachersPage({
  params: { lang },
}: {
  params: { lang: string };
}) {
  const [search, setSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["teachers", search],
    queryFn: () => teachersApi.list({ q: search }).then((res) => res.data.data),
  });

  const bulkImportMutation = useMutation({
    mutationFn: async (teachersData: any[]) => {
      const results = await Promise.allSettled(
        teachersData.map((teacher) => teachersApi.create(teacher)),
      );
      return results;
    },
    onSuccess: (results) => {
      const successful = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;

      if (successful > 0) {
        toast.success(`Successfully imported ${successful} teacher(s)`);
      }
      if (failed > 0) {
        toast.error(`Failed to import ${failed} teacher(s)`);
      }

      queryClient.invalidateQueries({ queryKey: ["teachers"] });
    },
  });

  const handleImport = (data: any[]) => {
    // Transform the data to match API format
    const transformedData = data.map((row) => ({
      fullName: row["Full Name"] || row.fullName || row.name,
      staffNo: row["Staff Number"] || row.staffNo || row.staffNumber,
      department: row.department || row.Department,
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
    teachers: {
      title: "Teachers",
      fullName: "Full Name",
      staffNo: "Staff Number",
      department: "Department",
      deleteConfirm: "Are you sure you want to delete this teacher?",
      importTitle: "Import Teachers",
      importDescription: "Upload a CSV or XLSX file with teacher data",
    },
  };

  return (
    <div className="space-y-4 container">
      <PageHeader
        title={dict.teachers.title}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              {dict.common.import}
            </Button>
            <Link href={`/${lang}/dashboard/teachers/create`}>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                {dict.common.create}
              </Button>
            </Link>
          </div>
        }
      />

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={dict.common.search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {isLoading ? (
        <div>Loading...</div>
      ) : data && data.length > 0 ? (
        <TeacherTable teachers={data} lang={lang} dict={dict} />
      ) : (
        <EmptyState
          icon={GraduationCap}
          title="No teachers found"
          description="Get started by creating a new teacher"
          action={
            <Link href={`/${lang}/dashboard/teachers/create`}>
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
        title={dict.teachers.importTitle}
        description={dict.teachers.importDescription}
        templateColumns={[
          "Full Name",
          "Staff Number",
          "Department",
          "Email",
          "Phone",
        ]}
      />
    </div>
  );
}
