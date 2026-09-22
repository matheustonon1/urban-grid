import type { Papel } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      papel: Papel;
      orgaoId: string | null;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    papel?: Papel;
    orgaoId?: string | null;
    // Timestamp (Date.now()) de quando este token foi emitido - usado pra
    // invalidar sessões emitidas antes de uma troca de senha (ver auth.ts).
    sessaoEmitidaEm?: number;
  }
}
