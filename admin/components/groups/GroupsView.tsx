"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";

import { groupsApi } from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Card, CardContent } from "@/components/ui/card";

type Group = {
  id: string;
  name: string;
};

export function GroupsView({ lang, dict }: { lang: string; dict: any }) {
  const { data: groups, isLoading: groupsLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: () =>
      groupsApi.list({ take: 1000 }).then((r) => r.data.data as Group[]),
  });

  return (
    <div className="space-y-4">
      <PageHeader title={dict?.groups?.title ?? "Groups"} />

      {groupsLoading ? (
        <div>{dict?.common?.loading ?? "Loading..."}</div>
      ) : groups && groups.length ? (
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {groups.map((g) => (
                <Link
                  key={g.id}
                  href={`/${lang}/dashboard/groups/${g.id}`}
                  className="block"
                >
                  <div className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50">
                    <div>
                      <div className="font-medium">{g.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {dict?.groups?.openGroupHint ??
                          "Open group to view students"}
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
          icon={Users}
          title={dict?.groups?.noGroupsTitle ?? "No groups found"}
          description={
            dict?.groups?.noGroupsDescription ??
            "Create groups first, then you can view students by group here"
          }
        />
      )}
    </div>
  );
}
