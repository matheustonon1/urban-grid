import { randomBytes } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";

import { aguardarHidratacao, emailTeste, limparDadosTeste } from "./helpers";

test.afterAll(async () => {
  await limparDadosTeste();
});

// Duas abas (ou um duplo clique) enviando o MESMO link de convite ao mesmo tempo. Antes, as duas
// passavam pela checagem "ainda sem senha" e a segunda gravava por cima da senha da primeira,
// ou estourava num erro interno ao apagar o token que a primeira já tinha apagado. Agora uma
// vence e a outra vê "link já usado"; a senha que vale é a da vencedora.
test("o mesmo convite enviado duas vezes ao mesmo tempo: uma define a senha, a outra vê link usado", async ({
  browser,
}) => {
  const cidade = await prisma.cidade.findFirstOrThrow();
  const email = emailTeste("convite-corrida");
  const orgao = await prisma.orgao.create({
    data: { nome: `Órgão E2E convite ${Date.now()}`, cidadeId: cidade.id, email },
  });
  const usuario = await prisma.user.create({
    data: {
      name: "Responsável do convite",
      email,
      papel: "ORGAO",
      orgaoId: orgao.id,
      cidadeId: cidade.id,
      emailVerified: new Date(),
      nivelVerificacao: "EMAIL",
    },
  });
  const token = randomBytes(24).toString("hex");
  await prisma.verificationToken.create({
    data: { identifier: email, token, expires: new Date(Date.now() + 60 * 60 * 1000) },
  });

  const tentativas = [
    { senha: "SenhaForte123", contexto: await browser.newContext() },
    { senha: "OutraSenha4567", contexto: await browser.newContext() },
  ];
  const paginas: Array<{ senha: string; page: Page }> = [];
  for (const { senha, contexto } of tentativas) {
    const page = await contexto.newPage();
    await page.goto(`/orgao/definir-senha/${token}`);
    await aguardarHidratacao(page, 'input[name="senha"]');
    await page.fill('input[name="senha"]', senha);
    await page.fill('input[name="confirmarSenha"]', senha);
    paginas.push({ senha, page });
  }

  // Dispara os dois envios juntos e espera cada aba chegar a um desfecho: entrou (vai para Minha
  // conta ativar o segundo fator) ou viu o aviso de link já usado. Qualquer outra coisa (erro
  // interno, tela parada) não é nenhum dos dois e reprova.
  type Desfecho = "entrou" | "linkUsado" | "aguardando";
  const desfechos = await Promise.all(
    paginas.map(async ({ senha, page }): Promise<{ senha: string; desfecho: Desfecho }> => {
      await page.click('button[type="submit"]');
      const aviso = page.getByText("Este link já foi usado ou não é mais válido.");
      let desfecho = "aguardando" as Desfecho;
      await expect
        .poll(
          async () => {
            if (/\/painel\/conta/.test(page.url())) desfecho = "entrou";
            else if (await aviso.isVisible()) desfecho = "linkUsado";
            return desfecho;
          },
          { timeout: 30_000 }
        )
        .not.toBe("aguardando");
      return { senha, desfecho };
    })
  );

  expect(desfechos.filter((d) => d.desfecho === "entrou")).toHaveLength(1);
  expect(desfechos.filter((d) => d.desfecho === "linkUsado")).toHaveLength(1);

  const vencedora = desfechos.find((d) => d.desfecho === "entrou")!;
  const perdedora = desfechos.find((d) => d.desfecho === "linkUsado")!;

  // A senha gravada é a da vencedora; a da perdedora não sobrescreveu nada.
  const gravado = await prisma.user.findUniqueOrThrow({ where: { id: usuario.id } });
  expect(gravado.senhaHash).not.toBeNull();
  expect(await bcrypt.compare(vencedora.senha, gravado.senhaHash!)).toBe(true);
  expect(await bcrypt.compare(perdedora.senha, gravado.senhaHash!)).toBe(false);

  // O link foi consumido.
  expect(await prisma.verificationToken.count({ where: { token } })).toBe(0);

  await prisma.verificationToken.deleteMany({ where: { identifier: email } });
  for (const { contexto } of tentativas) await contexto.close();
});
