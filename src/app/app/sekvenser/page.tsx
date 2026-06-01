"use client";

import { SequencesManager } from "@/components/SequencesManager";
import { useDemo } from "@/lib/demo/store";

export default function SekvenserPage() {
  const { sequences } = useDemo();
  return <SequencesManager sequences={sequences} />;
}
