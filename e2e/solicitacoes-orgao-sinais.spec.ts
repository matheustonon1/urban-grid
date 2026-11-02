import { expect, test } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { criarAdminTeste, criarOrgaoTeste, limparDadosTeste } from "./helpers";

// O admin decide um pedido de acesso como órgão com o que o solicitante digitou. O cartão agora
// mostra o que ele não via: o tipo do domínio do e-mail, um órgão que já existe com aquele nome
// (aprovar adiciona a conta nova a ELE) e pedidos anteriores rejeitados.

test.afterAll(async () => {
  await limparDadosTeste();
});

async function login(page: import("@playwright/test").Page, email: string, senha: string) {
  await page.goto("/login");
  await page.fill('input[name="identificador"]', email);
  await page.fill('input[name="senha"]', senha);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/painel$/);
}

test("o cartão mostra o domínio do e-mail, o órgão já existente e o histórico de rejeições", async ({
  page,
}) => {
  const cidade = await prisma.cidade.findFirstOrThrow();
  const sufixo = Date.now();
  const { orgao: orgaoExistente } = await criarOrgaoTeste(cidade.id);

  // 1) Mesmo nome de um órgão que já existe nesta cidade, com e-mail pessoal.
  const emailPessoal = `e2e-teste-sinal-pessoal-${sufixo}@gmail.com`;
  await prisma.solicitacaoOrgao.create({
    data: {
      nomeOrgao: orgaoExistente.nome,
      cidadeId: cidade.id,
      nomeResponsavel: "Pessoa Que Pede E2E",
      email: emailPessoal,
    },
  });

  // 2) Órgão novo, e-mail de governo, e o mesmo e-mail já teve um pedido rejeitado antes.
  const emailGoverno = `e2e-teste-sinal-gov-${sufixo}@prefeitura.exemplo.gov.br`;
  const nomeNovo = `Órgão E2E Sinais Novo ${sufixo}`;
  await prisma.solicitacaoOrgao.create({
    data: {
      nomeOrgao: nomeNovo,
      cidadeId: cidade.id,
      nomeResponsavel: "Servidor Público E2E",
      email: emailGoverno,
      status: "REJEITADA",
      motivoRejeicao: "Sem comprovação.",
      analisadoEm: new Date(),
    },
  });
  await prisma.solicitacaoOrgao.create({
    data: {
      nomeOrgao: nomeNovo,
      cidadeId: cidade.id,
      nomeResponsavel: "Servidor Público E2E",
      email: emailGoverno,
    },
  });

  const { email, senha } = await criarAdminTeste();
  await login(page, email, senha);
  await page.goto("/solicitacoes-orgao");

  const cartaoPessoal = page.locator("article").filter({ hasText: emailPessoal });
  await expect(cartaoPessoal.getByText("Órgão já cadastrado · 1 responsável")).toBeVisible();
  await expect(cartaoPessoal.getByText("E-mail pessoal")).toBeVisible();
  await expect(
    cartaoPessoal.getByText(/Aprovar não cria outro: adiciona Pessoa Que Pede E2E como responsável dele/)
  ).toBeVisible();
  // São indícios, e o cartão diz isso e o que fazer.
  await expect(cartaoPessoal.getByText(/indícios, não comprovação/)).toBeVisible();

  const cartaoGoverno = page.locator("article").filter({ hasText: emailGoverno });
  await expect(cartaoGoverno.getByText("Domínio institucional")).toBeVisible();
  await expect(cartaoGoverno.getByText("1 pedido anterior rejeitado")).toBeVisible();
  // Órgão novo: nada de "já cadastrado".
  await expect(cartaoGoverno.getByText(/Órgão já cadastrado/)).toHaveCount(0);

  // O diálogo de aprovar de um órgão que já existe avisa que a conta passa a responder por ele.
  await cartaoPessoal.getByRole("button", { name: "Aprovar", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Este órgão já existe nesta cidade e tem 1 responsável");
  await page.getByRole("dialog").getByRole("button", { name: "Cancelar" }).click();
});
