import { redirect } from "next/navigation";

import { DEFAULT_TAB } from "@/navigation";

export default function HomePage() {
  redirect(`/${DEFAULT_TAB}`);
}
