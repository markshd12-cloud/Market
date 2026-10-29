import { Suspense } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { UserMenu, UserMenuSkeleton } from "@/components/shell/user-menu";
import { getCurrentUser } from "@/lib/auth";

async function CurrentUserMenu() {
  const user = await getCurrentUser();
  return <UserMenu displayName={user.displayName} email={user.email} />;
}

/**
 * Casca estática (vai no shell pré-renderizado); só o menu do usuário lê a
 * sessão, por isso fica dentro do <Suspense>.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      userSlot={
        <Suspense fallback={<UserMenuSkeleton />}>
          <CurrentUserMenu />
        </Suspense>
      }
    >
      {children}
    </AppShell>
  );
}
