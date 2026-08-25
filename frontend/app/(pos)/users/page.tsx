"use client";

import { ViewMount } from "@/components/view-mount";
import { UsersView } from "@/ui/users";

export default function Page() {
  return <ViewMount tab="users" view={UsersView} />;
}
