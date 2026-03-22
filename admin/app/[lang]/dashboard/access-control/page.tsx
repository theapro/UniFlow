"use client";

import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";

import { accessControlApi } from "@/lib/api";

type EditableRole = "TEACHER" | "STAFF" | "MANAGER";

type AccessControlMatrix = {
  roles: EditableRole[];
  permissions: string[];
  rolePermissions: Record<string, string[]>;
};

function roleLabel(role: EditableRole): string {
  if (role === "TEACHER") return "Teacher";
  if (role === "STAFF") return "Staff";
  return "Manager";
}

export default function AccessControlPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matrix, setMatrix] = useState<AccessControlMatrix | null>(null);
  const [pending, setPending] = useState<Set<string>>(new Set());

  const roles = matrix?.roles ?? ["TEACHER", "STAFF", "MANAGER"];

  const sortedPermissions = useMemo(() => {
    const base = matrix?.permissions ?? [];
    return [...base].sort((a, b) => a.localeCompare(b));
  }, [matrix?.permissions]);

  const isChecked = (role: EditableRole, permission: string) => {
    const list = matrix?.rolePermissions?.[role] ?? [];
    return list.includes(permission);
  };

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await accessControlApi.getMatrix();
      setMatrix(res.data.data as AccessControlMatrix);
    } catch (e: any) {
      const msg =
        typeof e?.response?.data?.message === "string"
          ? e.response.data.message
          : "Failed to load access control matrix";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = async (params: {
    role: EditableRole;
    permission: string;
    enabled: boolean;
  }) => {
    const key = `${params.role}::${params.permission}`;
    setPending((prev) => new Set(prev).add(key));
    setError(null);

    try {
      const res = await accessControlApi.toggle(params);
      const updated = res.data.data as {
        role: EditableRole;
        permissions: string[];
      };

      setMatrix((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          rolePermissions: {
            ...prev.rolePermissions,
            [updated.role]: updated.permissions,
          },
        };
      });
    } catch (e: any) {
      const msg =
        typeof e?.response?.data?.message === "string"
          ? e.response.data.message
          : "Failed to update role permissions";
      setError(msg);
    } finally {
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  return (
    <div className="container max-w-7xl py-10 space-y-6">
      <PageHeader
        title="Access Control"
        description="Toggle permissions for Teacher / Staff / Manager roles."
        actions={
          <Button variant="secondary" onClick={reload} disabled={loading}>
            Refresh
          </Button>
        }
      />

      {error && (
        <Card className="rounded-[32px] border border-border/40 bg-muted/10">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {error}
          </CardContent>
        </Card>
      )}

      <Card className="rounded-[32px] border border-border/40 bg-muted/10">
        <CardHeader>
          <CardTitle>Role → Permission matrix</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : sortedPermissions.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No permissions found. Run DB seed or add permissions first.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[340px]">Permission</TableHead>
                  {roles.map((r) => (
                    <TableHead key={r} className="text-center">
                      {roleLabel(r)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPermissions.map((p) => (
                  <TableRow key={p}>
                    <TableCell className="font-mono text-xs">{p}</TableCell>
                    {roles.map((r) => {
                      const cellKey = `${r}::${p}`;
                      const checked = isChecked(r, p);
                      const busy = pending.has(cellKey);

                      return (
                        <TableCell key={cellKey} className="text-center">
                          <div className="inline-flex items-center justify-center">
                            <Switch
                              checked={checked}
                              disabled={busy}
                              onCheckedChange={(next) =>
                                toggle({
                                  role: r,
                                  permission: p,
                                  enabled: next,
                                })
                              }
                              aria-label={`${r}:${p}`}
                            />
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
