"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Trash2, BookOpen, Users } from "lucide-react";
import { toast } from "sonner";

import { subjectsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

type Subject = {
  id: string;
  name: string;
  code: string | null;
  createdAt: string;
  updatedAt: string;
  cohort?: { id: string; code: string; year?: number | null } | null;
  parentGroup?: { id: string; name: string } | null;
  _count?: {
    teachers: number;
    lessons: number;
  };
};

function cohortLabel(c?: { code?: string; year?: number | null } | null) {
  const code = String(c?.code ?? "").trim();
  if (!code) return "(No cohort)";
  const year = typeof c?.year === "number" ? c?.year : null;
  return year ? `${code} (${year})` : code;
}

export function SubjectDetailView({
  lang,
  dict,
  id,
}: {
  lang: string;
  dict: any;
  id: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const { data: subject, isLoading } = useQuery({
    queryKey: ["subjects", id],
    queryFn: () => subjectsApi.getById(id).then((r) => r.data.data as Subject),
  });

  const deleteMutation = useMutation({
    mutationFn: () => subjectsApi.remove(id),
    onSuccess: async () => {
      toast.success(dict?.common?.success ?? "Deleted successfully");
      await queryClient.invalidateQueries({ queryKey: ["subjects"] });
      router.push(`/${lang}/dashboard/subjects`);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to delete subject");
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto py-12 text-center text-muted-foreground animate-pulse">
        {dict?.common?.loading ?? "Loading..."}
      </div>
    );
  }

  if (!subject) {
    return (
      <div className="container mx-auto py-12 text-center">
        <h2 className="text-xl font-bold">
          {dict?.common?.notFound ?? "Not found"}
        </h2>
        <Button variant="link" onClick={() => router.back()}>
          {dict?.common?.back ?? "Go back"}
        </Button>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto py-6 space-y-6">
      <Link
        href={`/${lang}/dashboard/subjects`}
        className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group"
      >
        <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
        {dict?.nav?.subjects ?? "Subjects"}
      </Link>

      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold tracking-tight">
            {subject.name}
          </h1>
          <div className="flex items-center gap-2">
            {subject.code ? (
              <Badge variant="outline" className="font-mono">
                {subject.code}
              </Badge>
            ) : (
              <Badge variant="secondary">
                {dict?.subjects?.noCode ?? "No code"}
              </Badge>
            )}

            {subject.parentGroup?.name ? (
              <Badge variant="secondary">{subject.parentGroup.name}</Badge>
            ) : (
              <Badge variant="outline">(No department)</Badge>
            )}

            <Badge variant="outline" className="font-mono">
              {cohortLabel(subject.cohort)}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() =>
              router.push(`/${lang}/dashboard/subjects/${subject.id}/edit`)
            }
          >
            <Pencil className="h-4 w-4 mr-2" />
            {dict?.common?.edit ?? "Edit"}
          </Button>
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4 mr-2" />
            {dict?.common?.delete ?? "Delete"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">
              {dict?.subjects?.overview ?? "Subject Overview"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
                  {dict?.common?.id ?? "ID"}
                </span>
                <p className="font-mono text-sm break-all">{subject.id}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
                  {dict?.common?.updatedAt ?? "Updated"}
                </span>
                <p className="text-sm">
                  {new Date(subject.updatedAt).toLocaleString(
                    lang === "uz" ? "uz-UZ" : "en-US",
                  )}
                </p>
              </div>
            </div>

            <Separator />

            <div className="flex items-center gap-6">
              <div className="p-3 bg-primary/10 rounded-full">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold text-2xl font-mono">
                  {subject._count?.teachers ?? 0}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {dict?.teachers?.title ?? "Teachers"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6 pt-2">
              <div className="p-3 bg-secondary/10 rounded-full">
                <BookOpen className="h-6 w-6 text-secondary-foreground" />
              </div>
              <div>
                <h4 className="font-semibold text-2xl font-mono">
                  {subject._count?.lessons ?? 0}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {dict?.lessons?.title ?? "Lessons"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-destructive/20 h-fit">
          <CardHeader>
            <CardTitle className="text-lg text-destructive">
              {dict?.common?.dangerZone ?? "Danger Zone"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {dict?.subjects?.deleteHint ??
                "Deleting this subject will remove related schedule entries and lessons."}
            </p>
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => setDeleteOpen(true)}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {deleteMutation.isPending
                ? (dict?.common?.loading ?? "Deleting...")
                : (dict?.common?.delete ?? "Delete")}
            </Button>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={dict?.common?.delete ?? "Delete"}
        description={
          dict?.subjects?.deleteConfirm ??
          "Are you sure you want to delete this subject?"
        }
        confirmLabel={dict?.common?.delete ?? "Delete"}
        cancelLabel={dict?.common?.cancel ?? "Cancel"}
        onConfirm={() => deleteMutation.mutate()}
      />
    </div>
  );
}
