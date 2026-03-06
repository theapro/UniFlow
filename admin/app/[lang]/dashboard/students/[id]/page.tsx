"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { groupsApi, studentsApi } from "@/lib/api";
import { StudentForm } from "@/components/students/StudentForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Mail, Clock, ShieldCheck, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

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

  const { data: groupsResp } = useQuery({
    queryKey: ["groups"],
    queryFn: () => groupsApi.list({ take: 200 }),
  });

  const groups = Array.isArray(groupsResp?.data?.data)
    ? groupsResp.data.data
    : [];

  const updateMutation = useMutation({
    mutationFn: (data: any) => studentsApi.update(id, data),
  });

  const resendCredentialsMutation = useMutation({
    mutationFn: () => studentsApi.resendCredentials(id),
    onSuccess: () => {
      toast.success("Kirish ma'lumotlari yuborildi");
      queryClient.invalidateQueries({ queryKey: ["students", id] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Xatolik yuz berdi");
    },
  });

  if (isLoading) return <LoadingSkeleton />;
  if (!student) return <div className="p-8 text-center">Talaba topilmadi</div>;

  const hasLogin = !!student?.user?.lastLoginAt;

  const dict = {
    common: {
      save: "Saqlash",
      cancel: "Bekor qilish",
      loading: "Yuklanmoqda...",
    },
    students: {
      editTitle: "Ma'lumotlarni tahrirlash",
      createTitle: "Yangi talaba",
      fullName: "To'liq ism",
      email: "Email",
      studentNo: "Talaba raqami",
      group: "Guruh",
    },
  };

  return (
    <div className="container space-y-6">
      {/* Back Button & Title */}
      <Link
        href={`/${lang}/dashboard/students`}
        className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Students
      </Link>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Chap tomon: Faqat Forma */}
        <div className="lg:col-span-2">
          <div className="space-y-4">
            <StudentForm
              student={student}
              lang={lang}
              dict={dict}
              groups={groups}
              onSubmit={async (data) => {
                await updateMutation.mutateAsync(data);
                toast.success("Muvaffaqiyatli yangilandi");
                queryClient.invalidateQueries({ queryKey: ["students", id] });
              }}
            />
          </div>
        </div>

        {/* O'ng tomon: Faqat Hisob holati (Account) */}
        <div className="space-y-6">
          <Card className="border-muted/50 shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/30 border-b py-4">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-muted-foreground" />
                Hisob ma'lumotlari
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-6">
              <div className="space-y-4">
                <InfoItem
                  label="Email manzil"
                  value={student.user?.email}
                  icon={<Mail className="w-3.5 h-3.5" />}
                />

                <div className="flex justify-between items-center py-1">
                  <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                    Status
                  </span>
                  <Badge
                    variant={hasLogin ? "default" : "secondary"}
                    className="rounded-sm px-2 py-0 text-[10px]"
                  >
                    {hasLogin ? "AKTIV" : "KIRILMAGAN"}
                  </Badge>
                </div>

                <InfoItem
                  label="Oxirgi faollik"
                  value={
                    student.user?.lastLoginAt
                      ? new Date(student.user.lastLoginAt).toLocaleString()
                      : "-"
                  }
                  icon={<Clock className="w-3.5 h-3.5" />}
                />
              </div>

              <Button
                variant="outline"
                className="w-full text-[11px] h-8 font-medium uppercase tracking-tight"
                disabled={
                  !student.user?.email || resendCredentialsMutation.isPending
                }
                onClick={() => resendCredentialsMutation.mutate()}
              >
                {resendCredentialsMutation.isPending
                  ? "Yuborilmoqda..."
                  : "Loginni qayta yuborish"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function InfoItem({
  label,
  value,
  icon,
}: {
  label: string;
  value?: string | null;
  icon: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
        {icon}
        {label}
      </div>
      <p className="text-sm font-medium">{value || "-"}</p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <Skeleton className="h-8 w-24" />
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Skeleton className="h-[400px] w-full rounded-xl" />
        </div>
        <div>
          <Skeleton className="h-[250px] w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
