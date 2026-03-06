"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CreateStudentInput, UpdateStudentInput } from "@/types/student.types";

type GroupListItem = {
  id: string;
  name: string;
};

interface StudentFormProps {
  student?: {
    id: string;
    fullName: string;
    studentNo: string | null;
    groupId: string | null;
    phone?: string | null;
    cohort?: string | null;
    status?: string | null;
    note?: string | null;
    user?: {
      email: string;
    } | null;
  };
  lang: string;
  dict?: any;
  groups?: GroupListItem[];
  onSubmit: (data: CreateStudentInput | UpdateStudentInput) => Promise<void>;
}

export function StudentForm({
  student,
  lang,
  dict,
  groups = [],
  onSubmit,
}: StudentFormProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState(student?.fullName || "");
  const [email, setEmail] = useState(student?.user?.email || "");
  const [studentNo, setStudentNo] = useState(student?.studentNo || "");
  const [groupId, setGroupId] = useState(student?.groupId || "");
  const [phone, setPhone] = useState(student?.phone || "");
  const [cohort, setCohort] = useState(student?.cohort || "");
  const [status, setStatus] = useState<any>(student?.status || "ACTIVE");
  const [note, setNote] = useState(student?.note || "");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupId) return;
    setLoading(true);
    try {
      await onSubmit({
        fullName,
        ...(email ? { email } : {}),
        studentNo: studentNo || null,
        groupId,
        phone: phone || null,
        cohort: cohort || null,
        status,
        note: note || null,
      });
      router.push(`/${lang}/dashboard/students`);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const defaultDict = {
    common: { save: "Save", cancel: "Cancel", loading: "Saving..." },
    students: {
      editTitle: "Edit Student",
      createTitle: "Add New Student",
      fullName: "Full Name",
      email: "Email",
      studentNo: "Student Number",
      phone: "Phone",
      cohort: "Cohort",
      status: "Status",
      note: "Note",
      group: "Group",
      groupHelp: "Select a group from the table below.",
      importTitle: "Bulk Import",
      importDescription:
        "Upload your CSV/XLSX file to add multiple students at once.",
    },
  };

  const d = {
    common: {
      ...defaultDict.common,
      ...(dict?.common ?? {}),
    },
    students: {
      ...defaultDict.students,
      ...(dict?.students ?? {}),
    },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {student ? d.students.editTitle : d.students.createTitle}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">
                {d.students.fullName || "Full Name"}
              </Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{d.students.email || "Email"}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required={!student}
                placeholder="user@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="studentNo">
                {d.students.studentNo || "Student Number"}
              </Label>
              <Input
                id="studentNo"
                value={studentNo}
                onChange={(e) => setStudentNo(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">{d.students.phone || "Phone"}</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 9989077727712"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cohort">{d.students.cohort || "Cohort"}</Label>
              <Input
                id="cohort"
                value={cohort}
                onChange={(e) => setCohort(e.target.value)}
                placeholder="e.g. 2023"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">{d.students.status || "Status"}</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                  <SelectItem value="INACTIVE">INACTIVE</SelectItem>
                  <SelectItem value="GRADUATED">GRADUATED</SelectItem>
                  <SelectItem value="DROPPED">DROPPED</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-end justify-between gap-4">
              <div>
                <Label>{d.students.group || "Group"}</Label>
                <p className="text-xs text-muted-foreground">
                  {d.students.groupHelp ||
                    "Select a group from the table below."}
                </p>
              </div>
              {groupId ? (
                <p className="text-xs text-muted-foreground">Selected</p>
              ) : (
                <p className="text-xs text-destructive">Required</p>
              )}
            </div>

            <div className="rounded-lg border">
              <ScrollArea className="h-[220px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[44px]"></TableHead>
                      <TableHead>Name</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groups.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={2}
                          className="text-sm text-muted-foreground"
                        >
                          No groups found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      groups.map((g) => (
                        <TableRow
                          key={g.id}
                          className="cursor-pointer"
                          onClick={() => setGroupId(g.id)}
                        >
                          <TableCell>
                            <Checkbox
                              checked={groupId === g.id}
                              onCheckedChange={(checked) =>
                                setGroupId(checked ? g.id : "")
                              }
                              aria-label={`Select ${g.name}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            {g.name}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">{d.students.note || "Note"}</Label>
            <Input
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={loading || !groupId}>
              {loading ? d.common.loading : d.common.save}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              {d.common.cancel}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
