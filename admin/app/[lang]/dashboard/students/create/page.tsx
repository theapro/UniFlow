"use client";

import { useMutation } from "@tanstack/react-query";
import { studentsApi } from "@/lib/api";
import { StudentForm } from "@/components/students/StudentForm";
import { PageHeader } from "@/components/shared/PageHeader";
import { toast } from "sonner";

export default function CreateStudentPage({
  params: { lang },
}: {
  params: { lang: string };
}) {
  const createMutation = useMutation({
    mutationFn: studentsApi.create,
  });

  const dict = {
    common: {
      save: "Save",
      cancel: "Cancel",
      loading: "Loading...",
    },
    students: {
      createTitle: "Create Student",
      createSuccess: "Student created successfully",
      fullName: "Full Name",
      email: "Email",
      studentNo: "Student Number",
      group: "Group",
    },
  };

  return (
    <div className="space-y-4">
      <PageHeader title={dict.students.createTitle} />
      <StudentForm
        lang={lang}
        dict={dict}
        onSubmit={async (data) => {
          try {
            await createMutation.mutateAsync(data);
            toast.success(dict.students.createSuccess ?? "Student created");
          } catch (err: any) {
            const msg =
              err?.response?.data?.message ||
              err?.message ||
              "Failed to create student";
            toast.error(msg);
            throw err;
          }
        }}
      />
    </div>
  );
}
