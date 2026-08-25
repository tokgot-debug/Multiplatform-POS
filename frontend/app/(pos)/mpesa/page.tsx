"use client";

import { ViewMount } from "@/components/view-mount";
import { MpesaView } from "@/ui/mpesa";

export default function Page() {
  return <ViewMount tab="mpesa" view={MpesaView} />;
}
