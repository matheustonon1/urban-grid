import "dotenv/config";
import { defineConfig } from "prisma/config";

// Configuração do CLI do Prisma 7 (generate, migrate, db seed). O client da aplicação NÃO lê
// isto: ele usa o adapter de src/lib/prisma.ts.
//
// - `dotenv/config` carrega o .env, como o Prisma 6 fazia sozinho. Uma DATABASE_URL já definida
//   no ambiente (a de produção passada na linha de comando, ou a do CI) vence o .env.
// - `prisma generate` não conecta no banco, então a URL só precisa existir: sem ela, o
//   `postinstall` quebraria um checkout novo antes de alguém criar o .env. Um valor de
//   mentira basta; migrate e db seed usam a URL de verdade.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL || "mysql://sem-url:sem-url@localhost:3306/sem-url",
  },
});
