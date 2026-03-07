"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";

import { subjectsApi } from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type Subject = {
  id: string;
  name: string;
  code: string | null;
};

export function SubjectEditView({
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

  const [name, setName] = React.useState("");
  const [code, setCode] = React.useState("");

  const { data: subject, isLoading } = useQuery({
    queryKey: ["subjects", id],
    queryFn: () => subjectsApi.getById(id).then((r) => r.data.data as Subject),
  });

  React.useEffect(() => {
    if (!subject) return;
    setName(subject.name ?? "");
    setCode(subject.code ?? "");
  }, [subject]);

  const updateMutation = useMutation({
    mutationFn: (payload: { name: string; code?: string | null }) =>
      subjectsApi.update(id, payload),
    onSuccess: async () => {
      toast.success(dict?.common?.success ?? "Updated successfully");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["subjects"] }),
        queryClient.invalidateQueries({ queryKey: ["subjects", id] }),
      ]);
      router.push(`/${lang}/dashboard/subjects/${id}/view`);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to update subject");
    },
  });

  const canSubmit = name.trim().length > 0 && !updateMutation.isPending;

  return (
    <div className="container max-w-2xl mx-auto py-6 space-y-6">
      <Link
        href={`/${lang}/dashboard/subjects/${id}/view`}
        className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group"
      >
        <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
        {dict?.common?.back ?? "Back"}
      </Link>

      <PageHeader title={dict?.subjects?.editTitle ?? "Edit Subject"} />

      <Card className="shadow-sm border-none bg-muted/30">
        <CardHeader>
          <CardTitle className="text-lg">
            {dict?.subjects?.details ?? "Subject Details"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {dict?.subjects?.editHint ??
              "Changes will be synced to Google Sheets when sync is enabled."}
          </p>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!canSubmit) return;
              updateMutation.mutate({
                name: name.trim(),
                code: code.trim() ? code.trim() : null,
              });
            }}
            className="space-y-6"
          >
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-semibold">
                {dict?.subjects?.name ?? "Subject Name"} {" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="bg-background"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="code" className="text-sm font-semibold">
                {dict?.subjects?.code ?? "Subject Code"}
              </Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="bg-background uppercase"
                disabled={isLoading}
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-muted">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={updateMutation.isPending}
              >
                {dict?.common?.cancel ?? "Cancel"}
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                <Save className="h-4 w-4 mr-2" />
                {updateMutation.isPending
                  ? (dict?.common?.loading ?? "Saving...")
                  : (dict?.common?.save ?? "Save")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
