"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { EmailConnect } from "@/components/EmailConnect";
import { Settings } from "lucide-react";

export default function InnstillingerClient() {
  const searchParams = useSearchParams();
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    if (connected === "google") {
      setBanner("Gmail er koblet! Du kan sende kampanjer fra din adresse.");
    } else if (connected === "microsoft") {
      setBanner("Outlook er koblet! Du kan sende kampanjer fra din adresse.");
    } else if (error) {
      setBanner(`Kunne ikke koble e-post: ${decodeURIComponent(error)}`);
    }
  }, [searchParams]);

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-2 text-brand-gold">
          <Settings className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-wide">Innstillinger</span>
        </div>
        <h1 className="mt-2 font-display text-2xl font-bold text-slate-900">E-post og konto</h1>
        <p className="mt-2 max-w-lg text-sm text-slate-600">
          Koble Gmail eller Outlook én gang. Alle kampanjer sendes fra din egen innboks — kunden
          svarer direkte til deg.
        </p>
      </header>

      {banner && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {banner}
        </p>
      )}

      <EmailConnect light />
    </div>
  );
}
