"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { teachersApi } from "@/lib/api";
import { TeacherForm } from "@/components/teachers/TeacherForm";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function TeacherDetailPage({
  params: { lang, id },
}: {
  params: { lang: string; id: string };
}) {
  const queryClient = useQueryClient();

  const { data: teacher, isLoading } = useQuery({
    queryKey: ["teachers", id],
    queryFn: () => teachersApi.getById(id).then((res) => res.data.data),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => teachersApi.update(id, data),
  });

  const resendCredentialsMutation = useMutation({
    mutationFn: () => teachersApi.resendCredentials(id),
    onSuccess: () => {
      toast.success("Credentials resent");
      queryClient.invalidateQueries({ queryKey: ["teachers", id] });
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
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
    teachers: {
      editTitle: "Edit Teacher",
      detailTitle: "Teacher Details",
      fullName: "Full Name",
      email: "Email",
      staffNo: "Staff Number",
      department: "Department",
    },
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!teacher) {
    return <div>Teacher not found</div>;
  }

  const hasLogin = !!teacher?.user?.lastLoginAt;
  const canResend = !!teacher?.user?.email;

  return (
    <div className="space-y-4">
      <PageHeader title={dict.teachers.detailTitle} />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-4">
          <TeacherForm
            teacher={teacher}
            lang={lang}
            dict={dict}
            onSubmit={async (data) => {
              try {
                await updateMutation.mutateAsync(data);
                toast.success("Teacher updated");
                queryClient.invalidateQueries({ queryKey: ["teachers", id] });
                queryClient.invalidateQueries({ queryKey: ["teachers"] });
              } catch (err: any) {
                const msg =
                  err?.response?.data?.message ||
                  err?.message ||
                  "Failed to update teacher";
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
                  <p className="text-base">{teacher.user?.email || "-"}</p>
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
                    {teacher.user?.credentialsSentAt
                      ? new Date(
                          teacher.user.credentialsSentAt,
                        ).toLocaleString()
                      : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Last login
                  </p>
                  <p className="text-base">
                    {teacher.user?.lastLoginAt
                      ? new Date(teacher.user.lastLoginAt).toLocaleString()
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
              <CardTitle>Teaching Schedule</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Teaching schedule will be displayed here.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Classes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Assigned classes will be displayed here.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
