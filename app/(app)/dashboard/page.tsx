import type { Metadata } from "next";
import { Suspense } from "react";

import { DashboardContent } from "@/components/dashboard/dashboard-content";
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
    />
  );
}
