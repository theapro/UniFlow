"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { studentsApi } from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Pencil } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";

export default function StudentViewPage({
  params: { lang },
}: {
  params: { lang: string };
}) {
  const { id } = useParams();
  const queryClient = useQueryClient();

  const { data: student, isLoading } = useQuery({
    queryKey: ["student", id],
    queryFn: () =>
      studentsApi.getById(id as string).then((res) => res.data.data),
    enabled: !!id,
  });

  const resendCredentialsMutation = useMutation({
    mutationFn: () => studentsApi.resendCredentials(id as string),
    onSuccess: () => {
      toast.success("Credentials resent");
      queryClient.invalidateQueries({ queryKey: ["student", id] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to resend credentials";
      toast.error(msg);
    },
  });

  const dict = {
    common: {
      back: "Back",
      edit: "Edit",
      loading: "Loading...",
    },
    students: {
      viewTitle: "Student Details",
      fullName: "Full Name",
      studentNo: "Student Number",
      group: "Group",
      createdAt: "Created At",
      updatedAt: "Updated At",
    },
  };

  if (isLoading) {
    return <div className="p-8">{dict.common.loading}</div>;
  }

  if (!student) {
    return <div className="p-8">Student not found</div>;
  }

  const hasLogin = !!student?.user?.lastLoginAt;
  const canResend = !!student?.user?.email;

  return (
    <div className="space-y-4">
      <PageHeader
        title={dict.students.viewTitle}
        actions={
          <div className="flex gap-2">
            <Link href={`/${lang}/dashboard/students`}>
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {dict.common.back}
              </Button>
            </Link>
            <Link href={`/${lang}/dashboard/students/${id}`}>
              <Button>
                <Pencil className="mr-2 h-4 w-4" />
                {dict.common.edit}
              </Button>
            </Link>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{student.fullName}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {dict.students.studentNo}
              </p>
              <p className="text-base">{student.studentNo || "-"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {dict.students.group}
              </p>
              <p className="text-base">{student.group?.name || "-"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Email</p>
              <p className="text-base">{student.user?.email || "-"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Status
              </p>
              <div className="pt-1">
                <Badge variant={hasLogin ? "default" : "secondary"}>
                  {hasLogin ? "Logged in" : "Not logged in"}
                </Badge>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Credentials sent
              </p>
              <p className="text-base">
                {student.user?.credentialsSentAt
                  ? new Date(student.user.credentialsSentAt).toLocaleString()
                  : "-"}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Last login
              </p>
              <p className="text-base">
                {student.user?.lastLoginAt
                  ? new Date(student.user.lastLoginAt).toLocaleString()
                  : "-"}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {dict.students.createdAt}
              </p>
              <p className="text-base">
                {new Date(student.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {dict.students.updatedAt}
              </p>
              <p className="text-base">
                {new Date(student.updatedAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div>
            <Button
              type="button"
              variant="outline"
              disabled={!canResend || resendCredentialsMutation.isPending}
              onClick={() => resendCredentialsMutation.mutate()}
            >
              {resendCredentialsMutation.isPending
                ? "Resending..."
                : "Resend credentials"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
