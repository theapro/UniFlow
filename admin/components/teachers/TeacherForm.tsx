"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateTeacherInput, UpdateTeacherInput } from "@/types/teacher.types";
import { subjectsApi } from "@/lib/api";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

interface TeacherFormProps {
  teacher?: {
    id: string;
    fullName: string;
    staffNo: string | null;
    departmentId: string | null;
    email?: string | null;
    phone?: string | null;
    telegram?: string | null;
    note?: string | null;
    subjects?: Array<{ id: string; name: string }>;
    user?: {
      email: string;
    } | null;
  };
  lang: string;
  dict: any;
  onSubmit: (data: CreateTeacherInput | UpdateTeacherInput) => Promise<void>;
}

export function TeacherForm({
  teacher,
  lang,
  dict,
  onSubmit,
}: TeacherFormProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState(teacher?.fullName || "");
  const [email, setEmail] = useState(
    teacher?.email || teacher?.user?.email || "",
  );
  const [staffNo, setStaffNo] = useState(teacher?.staffNo || "");
  const [departmentId, setDepartmentId] = useState(teacher?.departmentId || "");
  const [phone, setPhone] = useState(teacher?.phone || "");
  const [telegram, setTelegram] = useState(teacher?.telegram || "");
  const [note, setNote] = useState(teacher?.note || "");
  const [loading, setLoading] = useState(false);

  const { data: subjects, isLoading: subjectsLoading } = useQuery({
    queryKey: ["subjects"],
    queryFn: () => subjectsApi.list({ take: 1000 }).then((r) => r.data.data),
  });

  const initialSubjectIds = useMemo(
    () => (teacher?.subjects ?? []).map((s) => s.id),
    [teacher?.subjects],
  );
  const [selectedSubjectIds, setSelectedSubjectIds] =
    useState<string[]>(initialSubjectIds);

  const subjectsById = useMemo(() => {
    const items = (subjects ?? []) as Array<{ id: string; name: string }>;
    return new Map(items.map((s) => [s.id, s]));
  }, [subjects]);

  const canSubmit = selectedSubjectIds.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canSubmit) {
      toast.error("Please select at least one subject");
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        fullName,
        ...(email ? { email } : {}),
        staffNo: staffNo || null,
        departmentId: departmentId || null,
        phone: phone || null,
        telegram: telegram || null,
        note: note || null,
        subjectIds: selectedSubjectIds,
      });
      router.push(`/${lang}/dashboard/teachers`);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {teacher ? dict.teachers.editTitle : dict.teachers.createTitle}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">{dict.teachers.fullName}</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">{dict.teachers.email || "Email"}</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required={!teacher}
              placeholder="user@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="staffNo">{dict.teachers.staffNo}</Label>
            <Input
              id="staffNo"
              value={staffNo}
              onChange={(e) => setStaffNo(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="departmentId">{dict.teachers.department}</Label>
            <Input
              id="departmentId"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              placeholder="Department ID"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">{dict.teachers.phone || "Phone"}</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+998..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="telegram">
              {dict.teachers.telegram || "Telegram"}
            </Label>
            <Input
              id="telegram"
              value={telegram}
              onChange={(e) => setTelegram(e.target.value)}
              placeholder="@username"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">{dict.teachers.note || "Note"}</Label>
            <Input
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>{dict.teachers.subjects || "Subjects"}</Label>
            <div className="rounded-md border p-3">
              {subjectsLoading ? (
                <div className="text-sm text-muted-foreground">Loading...</div>
              ) : (subjects ?? []).length ? (
                <ScrollArea className="h-[180px]">
                  <div className="space-y-2">
                    {(subjects as Array<{ id: string; name: string }>).map(
                      (s) => {
                        const checked = selectedSubjectIds.includes(s.id);
                        return (
                          <label
                            key={s.id}
                            className="flex items-center gap-2 text-sm cursor-pointer select-none"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => {
                                const next = Boolean(v);
                                setSelectedSubjectIds((prev) => {
                                  if (next) {
                                    return prev.includes(s.id)
                                      ? prev
                                      : [...prev, s.id];
                                  }
                                  return prev.filter((x) => x !== s.id);
                                });
                              }}
                            />
                            <span>{s.name}</span>
                          </label>
                        );
                      },
                    )}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-sm text-muted-foreground">
                  No subjects found. Run Teachers Sheets sync first.
                </div>
              )}

              {!canSubmit ? (
                <div className="mt-2 text-xs text-destructive">
                  Subject selection is required.
                </div>
              ) : null}

              {selectedSubjectIds.length ? (
                <div className="mt-3 text-xs text-muted-foreground">
                  Selected:{" "}
                  {selectedSubjectIds
                    .map((id) => subjectsById.get(id)?.name)
                    .filter(Boolean)
                    .join(", ")}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={loading || !canSubmit}>
              {loading ? dict.common.loading : dict.common.save}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              {dict.common.cancel}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
