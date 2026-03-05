import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { DataTable } from "@/components/data-table";
import { SectionCards } from "@/components/section-cards";

import data from "../../dashboard/data.json";

export default async function DashboardPage({
  params: { lang },
}: {
  params: { lang: string };
}) {
  return (
    <div className="-mx-4 space-y-6 lg:-mx-6">
      <SectionCards />
      <div className="px-4 lg:px-6">
        <ChartAreaInteractive />
      </div>
      <DataTable data={data} />
    </div>
  );
}
