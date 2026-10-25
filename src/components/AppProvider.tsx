"use client";

import { AppProvider as Provider } from "@/lib/app-context";

export default function AppProvider({ children }: { children: React.ReactNode }) {
  return <Provider>{children}</Provider>;
}
