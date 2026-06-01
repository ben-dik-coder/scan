"use client";

import { TemplatesManager } from "@/components/TemplatesManager";
import { useDemo } from "@/lib/demo/store";

export default function MalerPage() {
  const { templates, addTemplate, removeTemplate } = useDemo();
  return (
    <TemplatesManager
      templates={templates}
      onAdd={addTemplate}
      onRemove={removeTemplate}
    />
  );
}
