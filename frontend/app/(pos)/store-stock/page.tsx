"use client";

import { ViewMount } from "@/components/view-mount";
import { StoreStockView } from "@/ui/store-stock";

export default function Page() {
  return <ViewMount tab="store-stock" view={StoreStockView} />;
}
