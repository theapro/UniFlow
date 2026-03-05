"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { aiModelsApi } from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";

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

export default function AiModelsPage({
  params: { lang },
}: {
  params: { lang: string };
}) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["ai-models"],
    queryFn: async () => {
      const res = await aiModelsApi.list();
      return (res.data?.data ?? []) as AiModel[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (args: { id: string; patch: Partial<AiModel> }) => {
      const res = await aiModelsApi.update(args.id, args.patch);
      return res.data?.data as AiModel;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-models"] });
    },
    onError: (err: any) => {
      console.error(err);
      toast.error("Failed to update model");
    },
  });

  const title = "AI Models";

  return (
    <div className="space-y-4">
      <PageHeader title={title} />

      <Card>
        <CardHeader>
          <CardTitle>Admin model policy</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Toggle which models are enabled globally, and which are available to
            users.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Models</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : !data || data.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No models found.
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[220px]">Name</TableHead>
                    <TableHead className="min-w-[100px]">Provider</TableHead>
                    <TableHead className="min-w-[240px]">Model</TableHead>
                    <TableHead className="min-w-[120px]">Modality</TableHead>
                    <TableHead className="w-[90px] text-center">
                      Enabled
                    </TableHead>
                    <TableHead className="w-[140px] text-center">
                      User access
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((m) => {
                    const isBusy =
                      updateMutation.isPending &&
                      updateMutation.variables?.id === m.id;
                    return (
                      <TableRow
                        key={m.id}
                        className={isBusy ? "opacity-60" : ""}
                      >
                        <TableCell className="font-medium">
                          {m.displayName}
                        </TableCell>
                        <TableCell>{m.provider}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {m.model}
                        </TableCell>
                        <TableCell>{m.modality}</TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={m.isEnabled}
                            onCheckedChange={(checked) =>
                              updateMutation.mutate({
                                id: m.id,
                                patch: { isEnabled: Boolean(checked) },
                              })
                            }
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={m.enabledForUsers}
                            disabled={!m.isEnabled}
                            onCheckedChange={(checked) =>
                              updateMutation.mutate({
                                id: m.id,
                                patch: { enabledForUsers: Boolean(checked) },
                              })
                            }
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
