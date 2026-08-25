"use client";

import { ViewMount } from "@/components/view-mount";
import { FinanceView } from "@/ui/finance";

export default function Page() {
  return <ViewMount tab="finance" view={FinanceView} />;
}
