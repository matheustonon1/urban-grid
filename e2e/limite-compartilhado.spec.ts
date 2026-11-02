import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { excedeuLimiteCompartilhado } from "@/lib/seguranca/limiteCompartilhado";

import { limparDadosTeste } from "./helpers";

// O limite que protege e-mail e credencial precisa valer entre instâncias: o contador mora no
// banco. Aqui não há navegador - chama o módulo contra o MySQL de verdade e prova o que um
// unitário com mock não prova: a atomicidade sob concorrência, a janela e o estado vindo de OUTRA
// conexão (o que uma segunda instância serverless veria).

test.afterAll(async () => {
  await limparDadosTeste();
});

const escopo = () => `teste-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

test("dez chamadas simultâneas com limite 5: exatamente cinco passam e cinco são barradas", async () => {
  const e = escopo();
  const resultados = await Promise.all(
    Array.from({ length: 10 }, () => excedeuLimiteCompartilhado(e, "mesma-chave", 5, 60_000))
  );

  expect(resultados.filter((excedeu) => !excedeu)).toHaveLength(5);
  expect(resultados.filter((excedeu) => excedeu)).toHaveLength(5);
});

test("o estado vem do banco: o que outra conexão gravou vale aqui", async () => {
  const e = escopo();
  expect(await excedeuLimiteCompartilhado(e, "chave", 3, 60_000)).toBe(false);

  // Uma segunda "instância" (outra conexão, outro cliente) leva o contador ao limite.
  const outra = new PrismaClient();
  try {
    const linhas = await outra.limiteAbuso.findMany();
    expect(linhas.length).toBeGreaterThan(0);
    await outra.limiteAbuso.updateMany({ data: { contagem: 3 } });
  } finally {
    await outra.$disconnect();
  }

  // Esta instância nunca viu essas três chamadas e mesmo assim barra a próxima.
  expect(await excedeuLimiteCompartilhado(e, "chave", 3, 60_000)).toBe(true);
});

test("a janela vencida zera o contador", async () => {
  const e = escopo();
  expect(await excedeuLimiteCompartilhado(e, "chave", 1, 60_000)).toBe(false);
  expect(await excedeuLimiteCompartilhado(e, "chave", 1, 60_000)).toBe(true);

  await prisma.limiteAbuso.updateMany({ data: { expiraEm: new Date(Date.now() - 1000) } });

  expect(await excedeuLimiteCompartilhado(e, "chave", 1, 60_000)).toBe(false);
  expect(await excedeuLimiteCompartilhado(e, "chave", 1, 60_000)).toBe(true);
});

test("cada chave e cada escopo contam separado, e sem chave nunca bloqueia", async () => {
  const e = escopo();
  expect(await excedeuLimiteCompartilhado(e, "a", 1, 60_000)).toBe(false);
  expect(await excedeuLimiteCompartilhado(e, "a", 1, 60_000)).toBe(true);
  expect(await excedeuLimiteCompartilhado(e, "b", 1, 60_000)).toBe(false);
  expect(await excedeuLimiteCompartilhado(`${e}-outro`, "a", 1, 60_000)).toBe(false);

  for (let i = 0; i < 4; i++) {
    expect(await excedeuLimiteCompartilhado(e, null, 1, 60_000)).toBe(false);
  }
});

test("a tabela não guarda a chave em claro (IP, e-mail): só o HMAC", async () => {
  const e = escopo();
  const email = `e2e-teste-limite-${Date.now()}@example.com`;
  await excedeuLimiteCompartilhado(e, email, 5, 60_000);
  await excedeuLimiteCompartilhado(e, "203.0.113.77", 5, 60_000);

  const linhas = await prisma.limiteAbuso.findMany();
  expect(linhas.length).toBeGreaterThanOrEqual(2);
  for (const linha of linhas) {
    expect(linha.id).toMatch(/^[0-9a-f]{64}$/);
    expect(linha.id).not.toContain(email);
    expect(linha.id).not.toContain("203.0.113.77");
  }
});
