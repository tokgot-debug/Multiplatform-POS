"use client";

import { ViewMount } from "@/components/view-mount";
import { TillView } from "@/ui/till";

export default function Page() {
  return <ViewMount tab="till" view={TillView} />;
}
