"use client";

import { DownloadCloud } from "lucide-react";
import { useActionState } from "react";

import { importCatalog } from "@/app/(app)/admin/actions";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";

export function ImportPanel() {
  const [state, action, pending] = useActionState(importCatalog, undefined);

  return (
    <form action={action} className="space-y-4">
      <Button type="submit" loading={pending} className="w-full sm:w-auto">
        {!pending && <DownloadCloud className="size-4" aria-hidden />}
        {pending ? "Importando (até 1 min)…" : "Importar / atualizar catálogo"}
      </Button>
      {state?.ok === false && <FormAlert error={state.error} />}
      {state?.ok && (
        <FormAlert
          message={`Importado em ${state.seconds}s: ${state.items.toLocaleString("pt-BR")} itens, ${state.recipes.toLocaleString("pt-BR")} receitas, ${state.ingredients.toLocaleString("pt-BR")} ingredientes${state.ref ? ` (versão ${state.ref})` : ""}.`}
        />
      )}
    </form>
  );
}
