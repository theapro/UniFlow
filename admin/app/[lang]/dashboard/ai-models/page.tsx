"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { aiModelsApi } from "@/lib/api";

import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type AiModel = {
  id: string;
  provider: string;
  model: string;
  displayName: string;
  modality: "CHAT" | "VISION" | "STT" | "TTS" | "MODERATION";
  isEnabled: boolean;
  enabledForUsers: boolean;
  enabledForAdmins: boolean;
  sortOrder: number;
};

export default function AiModelsPage() {
  const queryClient = useQueryClient();

  const { data: models, isLoading } = useQuery({
    queryKey: ["ai-models"],
    queryFn: async () => {
      const res = await aiModelsApi.list();
      return (res.data?.data ?? []) as AiModel[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<AiModel> }) => {
      const res = await aiModelsApi.update(id, patch);
      return res.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-models"] });
    },
    onError: () => toast.error("Yangilashda xatolik yuz berdi"),
  });

  const handleUpdate = (id: string, patch: Partial<AiModel>) => {
    updateMutation.mutate({ id, patch });
  };

  return (
    <div className=" container space-y-6">
      <div className="flex flex-col gap-1">
        <PageHeader title="AI Models" />
        <p className="text-sm text-muted-foreground">
          Tizimdagi modellarni boshqarish va foydalanuvchilar uchun ruxsatlarni sozlash.
        </p>
      </div>

      <Card className="border-none shadow-none bg-transparent">
        <CardContent className="p-0">
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[300px]">Model & Provider</TableHead>
                  <TableHead>Modality</TableHead>
                  <TableHead className="text-right">Enabled</TableHead>
                  <TableHead className="text-right">User Access</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-10 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-12 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-12 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : models?.map((m) => (
                  <TableRow key={m.id} className="group">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">{m.displayName}</span>
                        <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
                          {m.provider} • {m.model}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-normal text-[10px] px-2 py-0">
                        {m.modality}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Switch
                        checked={m.isEnabled}
                        onCheckedChange={(v) => handleUpdate(m.id, { isEnabled: v })}
                        disabled={updateMutation.isPending}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Switch
                        checked={m.enabledForUsers}
                        disabled={!m.isEnabled || updateMutation.isPending}
                        onCheckedChange={(v) => handleUpdate(m.id, { enabledForUsers: v })}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}