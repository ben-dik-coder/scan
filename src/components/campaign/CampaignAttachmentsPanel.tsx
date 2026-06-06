"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileImage, FileText, Paperclip, Trash2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatFileSize,
  MAX_ATTACHMENT_FILE_BYTES,
  MAX_ATTACHMENT_FILES,
  MAX_ATTACHMENT_TOTAL_BYTES,
} from "@/lib/email/attachments";

export type PendingAttachment = {
  id: string;
  file: File;
  previewUrl?: string;
};

type Props = {
  attachments: PendingAttachment[];
  onChange: (attachments: PendingAttachment[]) => void;
  light?: boolean;
};

const ACCEPT =
  "image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.csv";

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function totalBytes(files: PendingAttachment[]) {
  return files.reduce((sum, item) => sum + item.file.size, 0);
}

export function CampaignAttachmentsPanel({
  attachments,
  onChange,
  light = true,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const next = [...attachments];
      let nextTotal = totalBytes(next);
      const rejected: string[] = [];

      for (const file of Array.from(files)) {
        if (next.length >= MAX_ATTACHMENT_FILES) {
          rejected.push(`Maks ${MAX_ATTACHMENT_FILES} filer.`);
          break;
        }
        if (file.size > MAX_ATTACHMENT_FILE_BYTES) {
          rejected.push(`"${file.name}" er for stor.`);
          continue;
        }
        if (nextTotal + file.size > MAX_ATTACHMENT_TOTAL_BYTES) {
          rejected.push("Total størrelse er for stor.");
          break;
        }

        const item: PendingAttachment = {
          id: makeId(),
          file,
          previewUrl: file.type.startsWith("image/")
            ? URL.createObjectURL(file)
            : undefined,
        };
        next.push(item);
        nextTotal += file.size;
      }

      if (rejected.length > 0) {
        setError(rejected[0]);
      } else {
        setError(null);
      }

      onChange(next);
    },
    [attachments, onChange]
  );

  useEffect(() => {
    return () => {
      for (const item of attachments) {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      }
    };
  }, [attachments]);

  function removeAttachment(id: string) {
    const removed = attachments.find((item) => item.id === id);
    if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
    onChange(attachments.filter((item) => item.id !== id));
    setError(null);
  }

  const total = totalBytes(attachments);

  return (
    <div className="space-y-3">
      <p className={cn("text-xs leading-relaxed", light ? "text-slate-500" : "text-white/45")}>
        Legg ved bilder eller filer fra PC-en din. Samme vedlegg sendes til alle mottakere.
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length > 0) {
            addFiles(e.dataTransfer.files);
          }
        }}
        className={cn(
          "rounded-xl border border-dashed px-4 py-8 text-center transition",
          light
            ? dragOver
              ? "border-brand-gold bg-amber-50/80"
              : "border-slate-200 bg-slate-50/80"
            : dragOver
              ? "border-brand-gold/50 bg-brand-gold/10"
              : "border-white/15 bg-white/[0.02]"
        )}
      >
        <Upload
          className={cn(
            "mx-auto h-8 w-8",
            light ? "text-slate-400" : "text-white/35"
          )}
          aria-hidden
        />
        <p className={cn("mt-3 text-sm font-semibold", light ? "text-slate-700" : "text-white/85")}>
          Dra filer hit, eller velg fra PC
        </p>
        <p className={cn("mt-1 text-xs", light ? "text-slate-500" : "text-white/45")}>
          Bilder, PDF, Word, Excel og mer · maks {formatFileSize(MAX_ATTACHMENT_TOTAL_BYTES)} totalt
        </p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cn(
            "mt-4 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition",
            light
              ? "bg-white text-slate-800 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
              : "bg-white/10 text-white hover:bg-white/15"
          )}
        >
          <Paperclip className="h-4 w-4" aria-hidden />
          Velg filer
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {attachments.length > 0 && (
        <ul className="space-y-2">
          {attachments.map((item) => (
            <li
              key={item.id}
              className={cn(
                "flex items-center gap-3 rounded-lg border px-3 py-2",
                light ? "border-slate-200 bg-white" : "border-white/10 bg-white/[0.03]"
              )}
            >
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md",
                  light ? "bg-slate-100" : "bg-white/10"
                )}
              >
                {item.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.previewUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : item.file.type.startsWith("image/") ? (
                  <FileImage className="h-5 w-5 opacity-60" aria-hidden />
                ) : (
                  <FileText className="h-5 w-5 opacity-60" aria-hidden />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "truncate text-sm font-medium",
                    light ? "text-slate-800" : "text-white/90"
                  )}
                >
                  {item.file.name}
                </p>
                <p className={cn("text-xs", light ? "text-slate-500" : "text-white/45")}>
                  {formatFileSize(item.file.size)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeAttachment(item.id)}
                className={cn(
                  "rounded p-1.5 transition",
                  light
                    ? "text-slate-400 hover:bg-slate-100 hover:text-red-600"
                    : "text-white/40 hover:bg-white/10 hover:text-red-300"
                )}
                title="Fjern fil"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className={cn("text-xs", light ? "text-slate-400" : "text-white/35")}>
        {attachments.length} fil{attachments.length === 1 ? "" : "er"} ·{" "}
        {formatFileSize(total)} av {formatFileSize(MAX_ATTACHMENT_TOTAL_BYTES)}
      </p>

      {error && (
        <p className={cn("text-xs", light ? "text-red-600" : "text-red-300")}>{error}</p>
      )}
    </div>
  );
}

export async function pendingAttachmentsToPayload(
  attachments: PendingAttachment[]
): Promise<Array<{ name: string; mimeType: string; contentBase64: string }>> {
  const results: Array<{ name: string; mimeType: string; contentBase64: string }> = [];

  for (const item of attachments) {
    const contentBase64 = await readFileAsBase64(item.file);
    results.push({
      name: item.file.name,
      mimeType: item.file.type || "application/octet-stream",
      contentBase64,
    });
  }

  return results;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Kunne ikke lese fil"));
        return;
      }
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Kunne ikke lese fil"));
    reader.readAsDataURL(file);
  });
}
