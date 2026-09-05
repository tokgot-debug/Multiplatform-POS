"use client";

import { ViewMount } from "@/components/view-mount";
import { InventoryView } from "@/ui/inventory";

export default function Page() {
  return <ViewMount tab="inventory" view={InventoryView} />;
}
