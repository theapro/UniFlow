import { PageHeader } from "@/components/shared/PageHeader";
import { StudentsSheetsActions } from "./StudentsSheetsActions";

export function StudentsSheetsHeader({ dict }: { dict: any }) {
  return (
    <PageHeader
      title={"Students Sheets"}
      description={
        dict?.sheets?.description ??
        "Manage synchronization between Google Sheets and Database."
      }
      actions={<StudentsSheetsActions dict={dict} />}
    />
  );
}
