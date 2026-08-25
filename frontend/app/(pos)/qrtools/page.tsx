"use client";

import { ViewMount } from "@/components/view-mount";
import { QrToolsView } from "@/ui/qr_export";

export default function Page() {
  return <ViewMount tab="qrtools" view={QrToolsView} />;
}
