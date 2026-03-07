"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { teachersApi } from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Pencil } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";

export default function TeacherViewPage({
  params: { lang },
}: {
  params: { lang: string };
}) {
  const { id } = useParams();
  const queryClient = useQueryClient();

  const { data: teacher, isLoading } = useQuery({
    queryKey: ["teacher", id],
    queryFn: () =>
      teachersApi.getById(id as string).then((res) => res.data.data),
    enabled: !!id,
  });

  const resendCredentialsMutation = useMutation({
    mutationFn: () => teachersApi.resendCredentials(id as string),
    onSuccess: () => {
      toast.success("Credentials resent");
      queryClient.invalidateQueries({ queryKey: ["teacher", id] });
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
      back: "Back",
      edit: "Edit",
      loading: "Loading...",
    },
    teachers: {
      viewTitle: "Teacher Details",
      fullName: "Full Name",
      staffNo: "Staff Number",
      department: "Department",
      subjects: "Subjects",
      phone: "Phone",
      telegram: "Telegram",
      note: "Note",
      createdAt: "Created At",
      updatedAt: "Updated At",
    },
  };

  if (isLoading) {
    return <div className="p-8">{dict.common.loading}</div>;
  }

  if (!teacher) {
    return <div className="p-8">Teacher not found</div>;
  }

  const hasLogin = !!teacher?.user?.lastLoginAt;
  const canResend = !!teacher?.user?.email;

  return (
    <div className="space-y-4">
      <PageHeader
        title={dict.teachers.viewTitle}
        actions={
          <div className="flex gap-2">
            <Link href={`/${lang}/dashboard/teachers`}>
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {dict.common.back}
              </Button>
            </Link>
            <Link href={`/${lang}/dashboard/teachers/${id}`}>
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
          <CardTitle>{teacher.fullName}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {dict.teachers.staffNo}
              </p>
              <p className="text-base">{teacher.staffNo || "-"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {dict.teachers.department}
              </p>
              <p className="text-base">{teacher.department?.name || "-"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Email</p>
              <p className="text-base">
                {teacher.email || teacher.user?.email || "-"}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {dict.teachers.subjects}
              </p>
              <p className="text-base">
                {(teacher.subjects ?? []).map((s: any) => s.name).join(", ") ||
                  "-"}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {dict.teachers.phone}
              </p>
              <p className="text-base">{teacher.phone || "-"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {dict.teachers.telegram}
              </p>
              <p className="text-base">{teacher.telegram || "-"}</p>
            </div>
            <div className="col-span-2">
              <p className="text-sm font-medium text-muted-foreground">
                {dict.teachers.note}
              </p>
              <p className="text-base whitespace-pre-wrap">
                {teacher.note || "-"}
              </p>
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
                  ? new Date(teacher.user.credentialsSentAt).toLocaleString()
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
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {dict.teachers.createdAt}
              </p>
              <p className="text-base">
                {new Date(teacher.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {dict.teachers.updatedAt}
              </p>
              <p className="text-base">
                {new Date(teacher.updatedAt).toLocaleDateString()}
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
