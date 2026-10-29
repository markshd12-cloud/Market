import { CircleAlert, CircleCheck } from "lucide-react";

import { cn } from "@/lib/utils";

export function FormAlert({ error, message }: { error?: string; message?: string }) {
  const text = error ?? message;
  if (!text) return null;
  const isError = Boolean(error);

  return (
    <div
      role={isError ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm",
        isError
          ? "border-danger/30 bg-danger/10 text-rose-200"
          : "border-success/30 bg-success/10 text-emerald-200",
      )}
    >
      {isError ? (
        <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      ) : (
        <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
      )}
      <span>{text}</span>
    </div>
  );
}
