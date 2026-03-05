"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { studentsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Pencil,
  Mail,
  User,
  Calendar,
  ShieldCheck,
  Loader2,
  Hash,
  Users2,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";

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
      toast.success("Credentials sent successfully");
      queryClient.invalidateQueries({ queryKey: ["student", id] });
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.message || "Error resending credentials",
      );
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/50" />
      </div>
    );
  }

  if (!student)
    return (
      <div className="p-8 text-center text-muted-foreground">
        Student not found
      </div>
    );

  const hasLogin = !!student?.user?.lastLoginAt;

  const InfoRow = ({ label, value, icon: Icon }: any) => (
    <div className="flex items-start gap-3 py-1">
      <div className="mt-0.5 rounded-md bg-muted p-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="space-y-0.5">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
          {label}
        </p>
        <p className="text-sm font-medium leading-snug">{value || "-"}</p>
      </div>
    </div>
  );

  return (
    <div className="container space-y-6">
      {/* Back Button - Minimalist */}
      <Link
        href={`/${lang}/dashboard/students`}
        className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Students
      </Link>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
        {/* CHAP TOMON: Profil va Asosiy boshqaruv */}
        <div className="md:col-span-4 space-y-4">
          <Card className="overflow-hidden border-none bg-muted/20 shadow-none">
            <CardContent className="p-6">
              <div className="flex flex-col items-center text-center">
                <div className="relative mb-4">
                  <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-inner">
                    <User className="h-12 w-12" />
                  </div>
                  <Badge
                    variant={hasLogin ? "default" : "secondary"}
                    className="absolute -bottom-2 right-[-10px] border-2 border-background px-2 py-0.5 text-[10px]"
                  >
                    {hasLogin ? "ACTIVE" : "PENDING"}
                  </Badge>
                </div>

                <h2 className="text-xl font-bold tracking-tight">
                  {student.fullName}
                </h2>
                <p className="text-sm text-muted-foreground/80 mb-6 italic">
                  {student.studentNo}
                </p>

                <div className="flex w-full flex-col gap-2">
                  <Link
                    href={`/${lang}/dashboard/students/${id}/edit`}
                    className="w-full"
                  >
                    <Button className="w-full shadow-sm" variant="default">
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit Profile
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    className="w-full bg-background"
                    disabled={
                      !student?.user?.email ||
                      resendCredentialsMutation.isPending
                    }
                    onClick={() => resendCredentialsMutation.mutate()}
                  >
                    {resendCredentialsMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Resend Credentials"
                    )}
                  </Button>
                </div>
              </div>

              <Separator className="my-6 bg-muted-foreground/10" />

              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
                  <Hash className="h-3 w-3" /> Quick Stats
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex justify-between items-center rounded-lg bg-background/50 p-2.5 px-3 border border-muted/20">
                    <span className="text-xs text-muted-foreground">Group</span>
                    <span className="text-sm font-bold">
                      {student.group?.name || "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center rounded-lg bg-background/50 p-2.5 px-3 border border-muted/20">
                    <span className="text-xs text-muted-foreground">
                      ID Number
                    </span>
                    <span className="text-sm font-mono">
                      {student.studentNo}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* O'NG TOMON: Batafsil ma'lumotlar */}
        <div className="md:col-span-8">
          <Card className="h-full border-none shadow-sm">
            <CardContent className="p-8">
              <div className="grid gap-10">
                {/* Section: Contact & Personal */}
                <section className="space-y-4">
                  <h3 className="text-[13px] font-bold uppercase tracking-[0.2em] text-primary/70">
                    Contact Information
                  </h3>
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <InfoRow
                      label="Email Address"
                      value={student.user?.email}
                      icon={Mail}
                    />
                    <InfoRow
                      label="Full Legal Name"
                      value={student.fullName}
                      icon={User}
                    />
                    <InfoRow
                      label="Current Group"
                      value={student.group?.name}
                      icon={Users2}
                    />
                  </div>
                </section>

                <Separator className="opacity-50" />

                {/* Section: System Metrics */}
                <section className="space-y-4">
                  <h3 className="text-[13px] font-bold uppercase tracking-[0.2em] text-primary/70">
                    System Activity
                  </h3>
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <InfoRow
                      label="Last Login Activity"
                      icon={ShieldCheck}
                      value={
                        student.user?.lastLoginAt
                          ? format(
                              new Date(student.user.lastLoginAt),
                              "MMM d, yyyy · HH:mm",
                            )
                          : "No login recorded"
                      }
                    />
                    <InfoRow
                      label="Account Created"
                      icon={Calendar}
                      value={format(
                        new Date(student.createdAt),
                        "MMMM d, yyyy",
                      )}
                    />
                    <InfoRow
                      label="Invitation Sent On"
                      icon={Mail}
                      value={
                        student.user?.credentialsSentAt
                          ? format(
                              new Date(student.user.credentialsSentAt),
                              "MMM d, yyyy",
                            )
                          : "Not sent yet"
                      }
                    />
                  </div>
                </section>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
