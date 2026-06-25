"use client";

import { useSearchParams } from "next/navigation";
import { SmartlistePageClient } from "./SmartlistePageClient";

export function SmartlistePageInner() {
  const searchParams = useSearchParams();
  const listId = searchParams.get("list");
  return <SmartlistePageClient initialListId={listId} />;
}
