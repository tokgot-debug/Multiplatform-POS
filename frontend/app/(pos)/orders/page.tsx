"use client";

import { ViewMount } from "@/components/view-mount";
import { OrdersView } from "@/ui/orders";

export default function Page() {
  return <ViewMount tab="orders" view={OrdersView} />;
}
