import { PageHeader } from "@/components/shared/PageHeader";
import { GradesSheetsActions } from "./GradesSheetsActions";

export function GradesSheetsHeader({ dict }: { dict: any }) {
  return (
    <PageHeader
      title={dict?.nav?.gradesSheets ?? "Grades Sheets"}
      description={
        dict?.sheetsGrades?.description ??
        "Manage synchronization and preview the Grades (Baholash) spreadsheet."
      }
      actions={<GradesSheetsActions dict={dict} />}
    />
  );
}
