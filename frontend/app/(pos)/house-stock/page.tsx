"use client";

import { ViewMount } from "@/components/view-mount";
import { HouseStockView } from "@/ui/house-stock";

export default function Page() {
  return <ViewMount tab="house-stock" view={HouseStockView} />;
}
