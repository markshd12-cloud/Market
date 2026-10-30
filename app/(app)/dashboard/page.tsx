import type { Metadata } from "next";
import { Suspense } from "react";

import { BankKpi, BankKpiSkeleton } from "@/components/dashboard/bank-kpi";
import { CollectorKpi, CollectorKpiSkeleton } from "@/components/dashboard/collector-kpi";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { GoalKpis, GoalKpisSkeleton, ProjectionCard } from "@/components/dashboard/plan-blocks";
import { GlassCard } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Dashboard" };

async function Greeting() {
  const user = await getCurrentUser();
  return <span className="text-gradient">{user.displayName}</span>;
}

export default function DashboardPage() {
  return (
    <DashboardContent
      greeting={
        <Suspense
          fallback={<span className="inline-block h-7 w-32 animate-pulse rounded-lg bg-white/[0.06] align-middle" />}
        >
          <Greeting />
        </Suspense>
      }
      goalKpis={
        <Suspense fallback={<GoalKpisSkeleton />}>
          <GoalKpis />
        </Suspense>
      }
      bank={
        <Suspense fallback={<BankKpiSkeleton />}>
          <BankKpi />
        </Suspense>
      }
      collector={
        <Suspense fallback={<CollectorKpiSkeleton />}>
          <CollectorKpi />
        </Suspense>
      }
      projection={
        <Suspense fallback={<GlassCard className="h-[460px] animate-pulse" />}>
          <ProjectionCard />
        </Suspense>
      }
    />
  );
}
