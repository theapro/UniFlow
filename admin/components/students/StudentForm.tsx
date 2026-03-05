"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateStudentInput, UpdateStudentInput } from "@/types/student.types";

interface StudentFormProps {
  student?: {
    id: string;
    fullName: string;
    studentNo: string | null;
    groupId: string | null;
    user?: {
      email: string;
    } | null;
  };
  lang: string;
  dict?: any;
  onSubmit: (data: CreateStudentInput | UpdateStudentInput) => Promise<void>;
}

export function StudentForm({
  student,
  lang,
  dict,
  onSubmit,
}: StudentFormProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState(student?.fullName || "");
  const [email, setEmail] = useState(student?.user?.email || "");
  const [studentNo, setStudentNo] = useState(student?.studentNo || "");
  const [groupId, setGroupId] = useState(student?.groupId || "");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit({
        fullName,
        ...(email ? { email } : {}),
        studentNo: studentNo || null,
        groupId: groupId || null,
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
      group: "Group",
      importTitle: "Bulk Import",
      importDescription:
        "Upload your CSV/XLSX file to add multiple students at once.",
    },
  };

  const d = dict ?? defaultDict;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {student ? d.students.editTitle : d.students.createTitle}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">{d.students.fullName}</Label>
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
            <Label htmlFor="studentNo">{d.students.studentNo}</Label>
            <Input
              id="studentNo"
              value={studentNo}
              onChange={(e) => setStudentNo(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="groupId">{d.students.group}</Label>
            <Input
              id="groupId"
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              placeholder="Group ID"
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
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
