import { getDictionary, type Locale } from "@/lib/i18n";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { FileSpreadsheet } from "lucide-react";

export default async function TeachersSheetsPage({
  params: { lang },
}: {
  params: { lang: Locale };
}) {
  const dict = await getDictionary(lang);

  return (
    <div className="container space-y-6 max-w-7xl mx-auto py-4">
      <PageHeader
        title="Teachers Sheets"
        description="Manage synchronization for Teacher data with Google Sheets."
      />
      <Card className="border-dashed">
        <CardHeader>
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <FileSpreadsheet className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Coming Soon</CardTitle>
          <CardDescription>
            The teacher data synchronization module is currently under
            development.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This feature will allow you to sync teacher profiles, subjects, and
            availability between UniFlow and Google Sheets seamlessly.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
