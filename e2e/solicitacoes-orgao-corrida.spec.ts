import { expect, test } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { criarAdminTeste, emailTeste, limparDadosTeste } from "./helpers";

let emailOrgaoCriado: string | undefined;

test.afterAll(async () => {
  if (emailOrgaoCriado) {
    await prisma.user.deleteMany({ where: { email: emailOrgaoCriado } });
  }
  await limparDadosTeste();
});

async function login(page: import("@playwright/test").Page, email: string, senha: string) {
  await page.goto("/login");
  await page.fill('input[name="identificador"]', email);
  await page.fill('input[name="senha"]', senha);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/painel$/);
}

test("aprovar duas solicitações com o mesmo e-mail ao mesmo tempo não cria duas contas nem trava com erro", async ({
  browser,
}) => {
  const { email: emailAdmin, senha } = await criarAdminTeste();
  const cidade = await prisma.cidade.findFirstOrThrow();
  const emailOrgao = emailTeste("orgao-corrida");
  const sufixo = Date.now();

  const solicitacaoA = await prisma.solicitacaoOrgao.create({
    data: {
      nomeOrgao: `Órgão Corrida A ${sufixo}`,
      cidadeId: cidade.id,
      nomeResponsavel: "Responsável A",
      email: emailOrgao,
    },
  });
  const solicitacaoB = await prisma.solicitacaoOrgao.create({
    data: {
      nomeOrgao: `Órgão Corrida B ${sufixo}`,
      cidadeId: cidade.id,
      nomeResponsavel: "Responsável B",
      email: emailOrgao,
    },
  });

  const contexto = await browser.newContext();
  const paginaA = await contexto.newPage();
  const paginaB = await contexto.newPage();
  await login(paginaA, emailAdmin, senha);

  await paginaA.goto("/solicitacoes-orgao");
  await paginaB.goto("/solicitacoes-orgao");

  const cartaoA = paginaA.locator(`text=Órgão Corrida A ${sufixo}`).locator("..");
  const cartaoB = paginaB.locator(`text=Órgão Corrida B ${sufixo}`).locator("..");

  // Dispara os dois "Aprovar" sem esperar um terminar - as duas
  // solicitações têm o mesmo e-mail, então a segunda a commitar esbarra
  // na constraint única de User.email. A correção precisa desfazer por
  // completo a transação da perdedora (ela volta a PENDENTE) em vez de
  // deixar a solicitação marcada como aprovada sem nenhuma conta criada.
  await Promise.all([
    cartaoA.getByRole("button", { name: "Aprovar" }).click(),
    cartaoB.getByRole("button", { name: "Aprovar" }).click(),
  ]);
  await paginaA.waitForTimeout(1500);

  const contas = await prisma.user.findMany({ where: { email: emailOrgao } });
  expect(contas).toHaveLength(1);
  emailOrgaoCriado = emailOrgao;

  const [finalA, finalB] = await Promise.all([
    prisma.solicitacaoOrgao.findUniqueOrThrow({ where: { id: solicitacaoA.id } }),
    prisma.solicitacaoOrgao.findUniqueOrThrow({ where: { id: solicitacaoB.id } }),
  ]);
  const statusFinais = [finalA.status, finalB.status].sort();
  // Uma aprovada de verdade, a outra volta pra PENDENTE (a transação foi
  // desfeita por inteiro) - nunca as duas "APROVADA" com uma delas sem
  // conta nenhuma por trás.
  expect(statusFinais).toEqual(["APROVADA", "PENDENTE"]);

  await prisma.solicitacaoOrgao.deleteMany({ where: { id: { in: [solicitacaoA.id, solicitacaoB.id] } } });
  await contexto.close();
});
