import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { PrismaClient } from "@/generated/prisma/client";

import { configDoAdapter } from "./bancoDeDados";

// Prisma 7: o client não traz mais o motor de consulta dentro dele, e sim fala com o banco por um
// driver adapter (aqui o do `mariadb`, que serve ao MySQL e ao TiDB). A configuração vem da mesma
// DATABASE_URL de sempre, lida por configDoAdapter.
//
// Sem DATABASE_URL o client é criado mesmo assim (apontando para um endereço de mentira) e falha
// na primeira consulta, como o do Prisma 6: importar este módulo num teste, no `next typegen` ou
// no build de uma rota que nunca consulta o banco não pode derrubar quem não precisa dele.
const URL_SEM_BANCO = "mysql://sem-url:sem-url@localhost:3306/sem-url";

function criarCliente() {
  const url = process.env.DATABASE_URL || URL_SEM_BANCO;
  return new PrismaClient({ adapter: new PrismaMariaDb(configDoAdapter(url)) });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? criarCliente();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
