import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Tudo, exceto estáticos, imagens e a captura do Data Client (sem sessão:
    // a chave pessoal no caminho é conferida no banco).
    "/((?!_next/static|_next/image|api/capture|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
