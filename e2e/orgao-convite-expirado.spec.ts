import { expect, test } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { emailTeste, limparDadosTeste } from "./helpers";

// Convite de órgão vale 24 h. Quem o deixou vencer pede outro na própria página do link
// (antes só o admin podia reenviar, e o convidado nem sabia a quem pedir).

// Qual das mensagens aparece depende do ambiente: com o Resend de teste, example.com é
// recusado; sem ele, o e-mail só vai para o log; com um domínio verificado, sai de verdade.
// Nos três a pessoa vê o que aconteceu (o aviso vai para `alert` ou `status`, conforme o tom).
const RESULTADO_DO_ENVIO =
  /Enviamos um novo link|Não conseguimos enviar o e-mail|não está configurado/;

test.afterAll(async () => {
  await prisma.verificationToken.deleteMany({ where: { identifier: { contains: "e2e-teste" } } });
  await limparDadosTeste();
});

async function conviteVencido() {
  const cidade = await prisma.cidade.findFirstOrThrow();
  const email = emailTeste("convite-vencido");
  const orgao = await prisma.orgao.create({
    data: { nome: `Órgão Convite Vencido E2E ${Date.now()}`, cidadeId: cidade.id },
  });
  await prisma.user.create({
    data: {
      name: "Responsável do convite vencido",
      email,
      papel: "ORGAO",
      orgaoId: orgao.id,
      senhaHash: null,
      emailVerified: new Date(),
    },
  });
  const token = `e2e-teste-token-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  await prisma.verificationToken.create({
    data: { identifier: email, token, expires: new Date(Date.now() - 60_000) },
  });
  return { email, token, orgao };
}

test("convite vencido: a página oferece um novo link, que substitui o antigo", async ({ page }) => {
  const { email, token } = await conviteVencido();

  await page.goto(`/orgao/definir-senha/${token}`);
  await expect(page.getByRole("heading", { name: "Seu convite expirou" })).toBeVisible();
  // Não pede (nem mostra) e-mail nenhum: o novo link vai para o do próprio convite.
  await expect(page.locator('input[name="email"]')).toHaveCount(0);

  await page.getByRole("button", { name: "Enviar novo link" }).click();
  await expect(page.getByText(RESULTADO_DO_ENVIO)).toBeVisible();

  const tokens = await prisma.verificationToken.findMany({ where: { identifier: email } });
  expect(tokens).toHaveLength(1);
  expect(tokens[0].token).not.toBe(token);
  expect(tokens[0].expires.getTime()).toBeGreaterThan(Date.now());

  // O link antigo foi substituído: já não vale e a página diz isso.
  await page.goto(`/orgao/definir-senha/${token}`);
  await expect(page.getByRole("heading", { name: "Link inválido ou expirado" })).toBeVisible();

  // E o novo link leva à definição de senha.
  await page.goto(`/orgao/definir-senha/${tokens[0].token}`);
  await expect(page.getByText("Defina uma senha")).toBeVisible();
});

test("o novo link tem limite: depois de 3 pedidos a página recusa", async ({ page }) => {
  const { email, token } = await conviteVencido();
  await page.goto(`/orgao/definir-senha/${token}`);

  // Cada pedido troca o token vencido por um novo; o teste recoloca o MESMO token vencido
  // entre os cliques, porque o limite é por link (o valor do token), não por conta.
  for (let i = 0; i < 3; i++) {
    await prisma.verificationToken.deleteMany({ where: { identifier: email } });
    await prisma.verificationToken.create({
      data: { identifier: email, token, expires: new Date(Date.now() - 60_000) },
    });
    await page.goto(`/orgao/definir-senha/${token}`);
    await page.getByRole("button", { name: "Enviar novo link" }).click();
    await expect(page.getByText(RESULTADO_DO_ENVIO)).toBeVisible();
  }

  await prisma.verificationToken.deleteMany({ where: { identifier: email } });
  await prisma.verificationToken.create({
    data: { identifier: email, token, expires: new Date(Date.now() - 60_000) },
  });
  await page.goto(`/orgao/definir-senha/${token}`);
  await page.getByRole("button", { name: "Enviar novo link" }).click();
  await expect(page.getByText("Você já pediu novos links demais")).toBeVisible();
});

test("link que nunca existiu continua sendo só 'inválido ou expirado', sem oferecer envio", async ({
  page,
}) => {
  await page.goto("/orgao/definir-senha/token-que-nunca-existiu");
  await expect(page.getByRole("heading", { name: "Link inválido ou expirado" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Enviar novo link" })).toHaveCount(0);
});

test("conta que já definiu a senha não recebe novo convite, mesmo com um link vencido em mãos", async ({
  page,
}) => {
  const { email, token } = await conviteVencido();
  await prisma.user.update({ where: { email }, data: { senhaHash: "hash-qualquer" } });

  await page.goto(`/orgao/definir-senha/${token}`);
  await expect(page.getByRole("heading", { name: "Link inválido ou expirado" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Enviar novo link" })).toHaveCount(0);
});
