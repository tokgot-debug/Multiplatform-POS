"use client";

import { ScreenFrame } from "@/components/screen-frame";
import { MpesaScreen } from "@/components/screens/mpesa-screen";

export default function Page() {
  return (
    <ScreenFrame tab="mpesa">
      <MpesaScreen />
    </ScreenFrame>
  );
}
