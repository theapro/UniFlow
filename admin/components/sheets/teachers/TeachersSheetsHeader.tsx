import { PageHeader } from "@/components/shared/PageHeader";
import { TeachersSheetsActions } from "./TeachersSheetsActions";

export function TeachersSheetsHeader({ dict }: { dict: any }) {
  return (
    <PageHeader
      title={dict?.nav?.teachersSheets ?? "Teachers Sheets"}
      description={
        dict?.sheetsTeachers?.description ??
        "Manage synchronization between TeachersWithSubjects Google Sheet and Database."
      }
      actions={<TeachersSheetsActions dict={dict} />}
    />
  );
}
