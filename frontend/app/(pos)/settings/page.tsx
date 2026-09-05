"use client";

import { ViewMount } from "@/components/view-mount";
import { SettingsView } from "@/ui/settings";

export default function Page() {
  return <ViewMount tab="settings" view={SettingsView} />;
}
