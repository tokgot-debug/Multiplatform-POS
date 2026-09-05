"use client";

import { ViewMount } from "@/components/view-mount";
import { AuditLogsView } from "@/ui/audit-logs";

export default function Page() {
  return <ViewMount tab="audit-logs" view={AuditLogsView} />;
}
