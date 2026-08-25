"use client";

import { ViewMount } from "@/components/view-mount";
import { ShiftsView } from "@/ui/shifts";

export default function Page() {
  return <ViewMount tab="shifts" view={ShiftsView} />;
}
