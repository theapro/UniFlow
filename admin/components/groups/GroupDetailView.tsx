"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Users } from "lucide-react";

import { groupsApi, studentsApi } from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { StudentTable } from "@/components/students/StudentTable";

type Group = {
  id: string;
  name: string;
};

export function GroupDetailView({
  lang,
  dict,
  id,
}: {
  lang: string;
  dict: any;
  id: string;
}) {
  const { data: group, isLoading: groupLoading } = useQuery({
    queryKey: ["groups", id],
    queryFn: () => groupsApi.getById(id).then((r) => r.data.data as Group),
  });

  const { data: students, isLoading: studentsLoading } = useQuery({
    queryKey: ["students", { groupId: id }],
    queryFn: () =>
      studentsApi.list({ groupId: id, take: 1000 }).then((r) => r.data.data),
  });

  return (
    <div className="container space-y-4">
      <PageHeader
        title={group?.name ?? dict?.groups?.detailTitle ?? "Group"}
        actions={
          <Link href={`/${lang}/dashboard/groups`}>
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {dict?.common?.back ?? "Back"}
            </Button>
          </Link>
        }
      />

      {groupLoading || studentsLoading ? (
        <div>{dict?.common?.loading ?? "Loading..."}</div>
      ) : students && students.length ? (
        <StudentTable students={students} lang={lang} dict={dict} />
      ) : (
        <EmptyState
          icon={Users}
          title={dict?.common?.noData ?? "No data"}
          description={
            dict?.groups?.noStudentsDescription ??
            "No students found in this group"
          }
        />
      )}
    </div>
  );
}
