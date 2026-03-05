"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { studentsApi } from "@/lib/api";
import { StudentForm } from "@/components/students/StudentForm";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function StudentDetailPage({
  params: { lang, id },
}: {
  params: { lang: string; id: string };
}) {
  const queryClient = useQueryClient();

  const { data: student, isLoading } = useQuery({
    queryKey: ["students", id],
    queryFn: () => studentsApi.getById(id).then((res) => res.data.data),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => studentsApi.update(id, data),
  });

  const resendCredentialsMutation = useMutation({
    mutationFn: () => studentsApi.resendCredentials(id),
    onSuccess: () => {
      toast.success("Credentials resent");
      queryClient.invalidateQueries({ queryKey: ["students", id] });
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
      save: "Save",
      cancel: "Cancel",
      loading: "Loading...",
    },
    students: {
      editTitle: "Edit Student",
      detailTitle: "Student Details",
      fullName: "Full Name",
      email: "Email",
      studentNo: "Student Number",
      group: "Group",
      attendance: "Attendance",
      schedule: "Schedule",
    },
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!student) {
    return <div>Student not found</div>;
  }

  const hasLogin = !!student?.user?.lastLoginAt;
  const canResend = !!student?.user?.email;

  return (
    <div className="space-y-4">
      <PageHeader title={dict.students.detailTitle} />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-4">
          <StudentForm
            student={student}
            lang={lang}
            dict={dict}
            onSubmit={async (data) => {
              try {
                await updateMutation.mutateAsync(data);
                toast.success("Student updated");
              } catch (err: any) {
                const msg =
                  err?.response?.data?.message ||
                  err?.message ||
                  "Failed to update student";
                toast.error(msg);
                throw err;
              }
            }}
          />
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Email
                  </p>
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
                      ? new Date(
                          student.user.credentialsSentAt,
                        ).toLocaleString()
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

          <Card>
            <CardHeader>
              <CardTitle>{dict.students.attendance}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Attendance records will be displayed here.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{dict.students.schedule}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Schedule information will be displayed here.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
