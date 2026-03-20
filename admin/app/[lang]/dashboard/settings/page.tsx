import Link from "next/link";

import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function SettingsPage({
  params: { lang },
}: {
  params: { lang: string };
}) {
  return (
    <div className="container max-w-7xl py-10 space-y-12">
      <PageHeader title="Settings" />

      <Card className="rounded-[32px] border border-border/40 bg-muted/10">
        <CardHeader>
          <CardTitle>Administration</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-3">
          <div>
            <div className="font-medium">Danger Zone</div>
            <div className="text-sm text-muted-foreground">
              Dangerous maintenance actions.
            </div>
          </div>
          <Button variant="destructive" asChild>
            <Link href={`/${lang}/dashboard/settings/danger-zone`}>Open</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
