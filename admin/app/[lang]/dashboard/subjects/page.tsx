import { getDictionary, type Locale } from "@/lib/i18n";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SubjectsPage({
  params: { lang },
}: {
  params: { lang: Locale };
}) {
  const dict = await getDictionary(lang);

  return (
    <div className="space-y-4">
      <PageHeader
        title={dict.subjects.title}
        actions={
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            {dict.common.create}
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{dict.subjects.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Subjects list will be displayed here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
