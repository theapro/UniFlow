"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { maintenanceApi } from "@/lib/api";

import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

export default function DangerZonePage() {
  const [confirm, setConfirm] = React.useState<string>("");
  const [syncSheets, setSyncSheets] = React.useState<boolean>(true);

  const [result, setResult] = React.useState<any>(null);

  const purge = useMutation({
    mutationFn: async () => {
      const res = await maintenanceApi.purgeAllNonAdmin({
        confirm,
        syncSheets,
      });
      return res.data?.data;
    },
    onSuccess: (data) => {
      setResult(data);
      toast.success("Purge tugadi");
    },
    onError: (e: any) => {
      const msg =
        typeof e?.response?.data?.message === "string"
          ? e.response.data.message
          : typeof e?.message === "string"
            ? e.message
            : "Purge xatolik";
      toast.error(msg);
    },
  });

  const canRun = confirm.trim().length > 0;

  return (
    <div className="container space-y-6">
      <div className="flex flex-col gap-1">
        <PageHeader title="Danger Zone" />
        <p className="text-sm text-muted-foreground">
          Bu sahifa ADMIN’dan boshqa hamma ma’lumotlarni o‘chiradi (students,
          teachers, groups, subjects, schedule, attendance, grades) va xohlasangiz
          Sheets’dan ham mos tablarni o‘chiradi.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bulk purge</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border p-3 text-sm">
            <div className="font-medium">Confirm text</div>
            <div className="text-muted-foreground">
              Ishga tushirish uchun quyidagini aynan yozing:
            </div>
            <Badge variant="secondary" className="mt-2">
              DELETE_ALL_NON_ADMIN_DATA
            </Badge>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">confirm</div>
            <Input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="DELETE_ALL_NON_ADMIN_DATA"
            />
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <div className="text-sm font-medium">Sync / purge Sheets tabs</div>
              <div className="text-xs text-muted-foreground">
                Students/Teachers/Attendance/Grades spreadsheet tablari tozalanadi.
              </div>
            </div>
            <Switch
              checked={syncSheets}
              onCheckedChange={(v) => setSyncSheets(v)}
              disabled={purge.isPending}
            />
          </div>

          <Button
            variant="destructive"
            onClick={() => purge.mutate()}
            disabled={purge.isPending || !canRun}
          >
            {purge.isPending ? "Purging…" : "DELETE EVERYTHING (except ADMIN)"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Result</CardTitle>
        </CardHeader>
        <CardContent>
          {!result ? (
            <p className="text-sm text-muted-foreground">Hali natija yo‘q.</p>
          ) : (
            <pre className="max-h-[520px] overflow-auto rounded-md border bg-muted/30 p-3 text-xs whitespace-pre-wrap">
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
