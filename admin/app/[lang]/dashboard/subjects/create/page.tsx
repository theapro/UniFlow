"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { subjectsApi } from "@/lib/api";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Save } from "lucide-react";

export default function CreateSubjectPage({
  params: { lang },
}: {
  params: { lang: string };
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const router = useRouter();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (payload: { name: string; code?: string | null }) =>
      subjectsApi.create(payload),
    onSuccess: async () => {
      toast.success("Subject created successfully");
      await queryClient.invalidateQueries({ queryKey: ["subjects"] });
      router.push(`/${lang}/dashboard/subjects`);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to create subject");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate({ name, code: code || null });
  };

  return (
    <div className="container max-w-2xl mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader title="Create New Subject" />
      </div>

      <Card className="shadow-sm border-none bg-muted/30">
        <CardHeader>
          <CardTitle className="text-lg">Subject Details</CardTitle>
          <p className="text-sm text-muted-foreground">
            Provide the official name and an optional shorthand code for the
            subject.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-semibold">
                Subject Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="e.g. Advanced Mathematics"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="bg-background"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="code" className="text-sm font-semibold">
                Subject Code (Optional)
              </Label>
              <Input
                id="code"
                placeholder="e.g. MATH-401"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="bg-background uppercase"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-muted">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || !name.trim()}
              >
                <Save className="h-4 w-4 mr-2" />
                {createMutation.isPending ? "Creating..." : "Create Subject"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
