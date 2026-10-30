import { Crown, UserPlus, Users } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { CharacterForm } from "@/components/characters/character-form";
import { CardTitle, GlassCard } from "@/components/ui/card";
import { getCharacters } from "@/lib/finance";
import { createClient } from "@/lib/supabase/server";
import { formatSilver } from "@/lib/utils";

export const metadata: Metadata = { title: "Personagens" };

async function CharactersContent() {
  const supabase = await createClient();
  const [characters, { data: locs }] = await Promise.all([
    getCharacters(),
    supabase.from("locations").select("id").eq("active", true).order("sort_order"),
  ]);
  const locations = ((locs ?? []) as { id: string }[]).map((l) => l.id);

  return (
    <div className="space-y-4">
      {characters.map((c, i) => (
        <GlassCard key={c.id} neon={i === 0} className="p-5 sm:p-6">
          <CardTitle
            icon={i === 0 ? <Crown className="size-4" /> : <Users className="size-4" />}
            title={c.name}
            subtitle={[
              i === 0 ? "Principal (usado no dashboard)" : null,
              c.premium ? "Premium" : "Sem premium",
              c.goal_amount ? `Meta ${formatSilver(c.goal_amount)}${c.goal_days ? ` em ${c.goal_days} dias` : ""}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          />
          <div className="mt-5">
            <CharacterForm initial={c} locations={locations} />
          </div>
        </GlassCard>
      ))}

      <GlassCard className="p-5 sm:p-6">
        <CardTitle
          icon={<UserPlus className="size-4" />}
          title={characters.length ? "Novo personagem" : "Crie seu primeiro personagem"}
          subtitle="Cada personagem tem banco, operações e meta próprios. Só você vê."
        />
        <div className="mt-5">
          <CharacterForm locations={locations} />
        </div>
      </GlassCard>
    </div>
  );
}

export default function CharactersPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-subtle">Conta</p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-wide sm:text-3xl">Personagens</h1>
        <p className="mt-1 text-sm text-muted">Premium, cidade base e meta de cada personagem.</p>
      </header>
      <Suspense fallback={<GlassCard className="h-64 animate-pulse" />}>
        <CharactersContent />
      </Suspense>
    </div>
  );
}
