import { ChartSpline, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { CharacterSwitcher } from "@/components/operations/operation-forms";
import { ProjectionWorkbench } from "@/components/projections/projection-workbench";
import { GlassCard } from "@/components/ui/card";
import { getCharacters, pickCharacter } from "@/lib/finance";
import { getProjectionInput, goalOf } from "@/lib/projection-data";
import { formatSilver } from "@/lib/utils";

export const metadata: Metadata = { title: "Projeções" };

type SearchParams = Promise<{ p?: string }>;

async function ProjectionsContent({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const characters = await getCharacters();
  const character = pickCharacter(characters, sp.p);

  if (!character) {
    return (
      <GlassCard className="flex flex-col items-center gap-3 p-10 text-center">
        <ChartSpline className="size-8 text-violet-soft" aria-hidden />
        <p className="font-medium">Crie um personagem para projetar a meta.</p>
        <Link
          href="/personagens"
          className="mt-2 inline-flex h-10 items-center gap-1.5 rounded-xl border border-violet/40 bg-violet/15 px-4 text-sm text-violet-soft hover:bg-violet/25"
        >
          <Plus className="size-4" /> Criar personagem
        </Link>
      </GlassCard>
    );
  }

  const input = await getProjectionInput(character);
  const goal = goalOf(character);
  // Remonta a bancada quando o servidor muda os cenários (salvou, apagou, criou modelos).
  const signature = input.scenarios.map((s) => `${s.key}:${JSON.stringify(s)}`).join("|");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          <b className="text-foreground">{character.name}</b> · meta {formatSilver(goal.amount)} em {goal.days} dias
          {!goal.fromCharacter && (
            <>
              {" "}
              (padrão;{" "}
              <Link href="/personagens" className="text-violet-soft hover:underline">
                defina a sua
              </Link>
              )
            </>
          )}
        </p>
        <CharacterSwitcher characters={characters} current={character.id} />
      </div>
      <ProjectionWorkbench
        key={`${character.id}|${signature}`}
        characterId={character.id}
        start={input.start}
        goal={goal.amount}
        goalDays={goal.days}
        saved={input.scenarios}
        history={input.history}
      />
    </div>
  );
}

export default function ProjectionsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-subtle">Finanças</p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-wide sm:text-3xl">Projeções</h1>
        <p className="mt-1 text-sm text-muted">
          Cenários comparados: caminho esperado, faixa provável e a chance real de bater a meta.
        </p>
      </header>
      <Suspense fallback={<GlassCard className="h-[480px] animate-pulse" />}>
        <ProjectionsContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
