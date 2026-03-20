"use client";

import { useMutation } from "@tanstack/react-query";
import { teachersApi } from "@/lib/api";
import { TeacherForm } from "@/components/teachers/TeacherForm";
import { PageHeader } from "@/components/shared/PageHeader";

export default function CreateTeacherPage({
  params: { lang },
}: {
  params: { lang: string };
}) {
  const createMutation = useMutation({
    mutationFn: teachersApi.create,
  });

  const dict = {
    common: {
      save: "Save",
      cancel: "Cancel",
      loading: "Loading...",
    },
    teachers: {
      createTitle: "Create Teacher",
      fullName: "Full Name",
      email: "Email",
      staffNo: "Staff Number",
      department: "Department",
    },
  };

  return (
    <div className="container max-w-7xl py-10 space-y-12">
      <PageHeader title={dict.teachers.createTitle} />
      <TeacherForm
        lang={lang}
        dict={dict}
        onSubmit={async (data) => {
          await createMutation.mutateAsync(data);
        }}
      />
    </div>
  );
}
