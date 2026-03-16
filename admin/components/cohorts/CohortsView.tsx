"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Layers } from "lucide-react";
import { toast } from "sonner";

import { cohortsApi } from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CohortRow = {
  id: string;
  code: string;
  sortOrder: number;
  year?: number | null;
  _count?: { groups?: number };
};

export function CohortsView({ lang, dict }: { lang: string; dict: any }) {
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = React.useState(false);
  const [codeDraft, setCodeDraft] = React.useState("");
  const [sortOrderDraft, setSortOrderDraft] = React.useState<string>("");

  const { data: cohorts, isLoading } = useQuery({
    queryKey: ["cohorts"],
    queryFn: () =>
      cohortsApi.list({ take: 500 }).then((r) => r.data.data as CohortRow[]),
  });

  const createMutation = useMutation({
    mutationFn: (payload: { code: string; sortOrder?: number | null }) =>
      cohortsApi.create(payload),
    onSuccess: async () => {
      toast.success(dict?.common?.success ?? "Created");
      setCodeDraft("");
      setSortOrderDraft("");
      setCreateOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["cohorts"] });
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.message || err?.message || "Failed to create",
      );
    },
  });

  return (
    <div className="container space-y-4">
      <PageHeader
        title={dict?.nav?.cohorts ?? "Cohorts"}
        actions={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>{dict?.common?.create ?? "Create"}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{dict?.nav?.cohorts ?? "Cohorts"}</DialogTitle>
                <DialogDescription>
                  Create a cohort code like 23, 24, 25, or 19/20/21.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="cohortCode">Code</Label>
                  <Input
                    id="cohortCode"
                    value={codeDraft}
                    onChange={(e) => setCodeDraft(e.target.value)}
                    placeholder="e.g. 23"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sortOrder">Sort order (optional)</Label>
                  <Input
                    id="sortOrder"
                    value={sortOrderDraft}
                    onChange={(e) => setSortOrderDraft(e.target.value)}
                    placeholder="e.g. 30"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setCreateOpen(false)}
                  disabled={createMutation.isPending}
                >
                  {dict?.common?.cancel ?? "Cancel"}
                </Button>
                <Button
                  onClick={() =>
                    createMutation.mutate({
                      code: codeDraft.trim(),
                      sortOrder:
                        sortOrderDraft.trim().length === 0
                          ? null
                          : Number(sortOrderDraft),
                    })
                  }
                  disabled={
                    createMutation.isPending || codeDraft.trim().length === 0
                  }
                >
                  {createMutation.isPending
                    ? (dict?.common?.loading ?? "Loading...")
                    : (dict?.common?.create ?? "Create")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {isLoading ? (
        <div>{dict?.common?.loading ?? "Loading..."}</div>
      ) : cohorts && cohorts.length ? (
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {cohorts.map((c) => (
                <Link
                  key={c.id}
                  href={`/${lang}/dashboard/cohorts/${c.id}`}
                  className="block"
                >
                  <div className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50">
                    <div>
                      <div className="font-medium">{c.code}</div>
                      <div className="text-xs text-muted-foreground">
                        {typeof c._count?.groups === "number"
                          ? `${c._count.groups} groups`
                          : ""}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          icon={Layers}
          title="No cohorts"
          description="Create cohorts first, then add groups inside them."
        />
      )}
    </div>
  );
}
