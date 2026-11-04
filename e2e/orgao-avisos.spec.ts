import { expect, test, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import {
  apagarLogsDeModeracao,
  completarDoisFatoresSeSolicitado,
  criarAdminTeste,
  criarCidadaoTeste,
  criarOrgaoTeste,
  criarReclamacaoTeste,
  limparDadosTeste,
} from "./helpers";

const idsParaLimpar: string[] = [];

test.afterAll(async () => {
  await apagarLogsDeModeracao({ id: { in: idsParaLimpar } });
  await prisma.reclamacao.deleteMany({ where: { id: { in: idsParaLimpar } } });
  await limparDadosTeste();
});

async function entrar(page: Page, email: string, senha: string, destino: RegExp) {
  await page.goto("/login");
  await page.fill('input[name="identificador"]', email);
  await page.fill('input[name="senha"]', senha);
  await page.click('button[type="submit"]');
  await completarDoisFatoresSeSolicitado(page, email);
  await page.waitForURL(destino);
}

// A decisão do moderador que publica: a mesma que a IA toma sozinha, só que manual.
async function aprovarComoAdmin(page: Page, protocolo: string) {
  const { email, senha } = await criarAdminTeste();
  await entrar(page, email, senha, /\/painel$/);
  await page.goto("/moderacao");
  const cartao = page.locator(`text=${protocolo}`).locator("..").locator("..");
  await cartao.getByRole("button", { name: "Aprovar" }).click();
  await expect(page.locator(`text=${protocolo}`)).toHaveCount(0);
}

async function notificacoesDeAviso(reclamacaoId: string) {
  const avisos = await prisma.notificacao.findMany({
    where: { reclamacaoId, tipo: "NOVA_RECLAMACAO_NA_FILA" },
    select: { userId: true },
  });
  return avisos.map((aviso) => aviso.userId);
}

test("publicar avisa só os órgãos que atendem a cidade e a categoria (e que estão ativos)", async ({
  page,
}) => {
  const cidade = await prisma.cidade.findFirstOrThrow();
  const outraCidade = await prisma.cidade.findFirstOrThrow({ where: { id: { not: cidade.id } } });
  const [categoriaA, categoriaB] = await prisma.categoria.findMany({
    where: { ativa: true },
    orderBy: { ordem: "asc" },
    take: 2,
  });

  // Cinco órgãos, um motivo cada para receber ou não receber o aviso.
  const atendeACategoria = await criarOrgaoTeste(cidade.id, { categoriaIds: [categoriaA.id] });
  const atendeOutraCategoria = await criarOrgaoTeste(cidade.id, { categoriaIds: [categoriaB.id] });
  const atendeQualquerUma = await criarOrgaoTeste(cidade.id);
  const deOutraCidade = await criarOrgaoTeste(outraCidade.id);
  const desativado = await criarOrgaoTeste(cidade.id);
  await prisma.orgao.update({ where: { id: desativado.orgao.id }, data: { ativo: false } });

  const { usuario: autor } = await criarCidadaoTeste();
  const reclamacao = await criarReclamacaoTeste(autor.id, {
    status: "AGUARDANDO_REVISAO",
    cidadeId: cidade.id,
    categoriaId: categoriaA.id,
  });
  idsParaLimpar.push(reclamacao.id);

  // Nada de aviso antes de a reclamação ser publicada: ela ainda não é pública.
  expect(await notificacoesDeAviso(reclamacao.id)).toEqual([]);

  await aprovarComoAdmin(page, reclamacao.protocolo);

  // Só as contas deste teste entram na conta: o banco de desenvolvimento pode ter órgãos reais
  // na mesma cidade, que também seriam avisados.
  const contasDoTeste = [
    atendeACategoria,
    atendeOutraCategoria,
    atendeQualquerUma,
    deOutraCidade,
    desativado,
  ].map((conta) => conta.usuario.id);
  const avisadosDoTeste = async () =>
    (await notificacoesDeAviso(reclamacao.id)).filter((id) => contasDoTeste.includes(id)).sort();

  // Atende a categoria, ou atende qualquer uma. Fora: outra categoria, outra cidade, desativado.
  await expect
    .poll(avisadosDoTeste)
    .toEqual([atendeACategoria.usuario.id, atendeQualquerUma.usuario.id].sort());

  // O autor continua recebendo o aviso dele, e só um: o do órgão é um tipo à parte.
  expect(
    await prisma.notificacao.count({
      where: { userId: autor.id, reclamacaoId: reclamacao.id, tipo: "RECLAMACAO_PUBLICADA" },
    })
  ).toBe(1);

  // Na tela do órgão: o aviso aparece em Notificações e leva à reclamação.
  await page.context().clearCookies();
  await entrar(page, atendeACategoria.email, atendeACategoria.senha, /\/orgao$/);
  await page.goto("/painel/notificacoes");
  await expect(page.getByText("Nova reclamação na sua fila")).toBeVisible();
  await expect(
    page.getByText(`"${reclamacao.titulo}" foi publicada e aguarda a primeira resposta do órgão.`)
  ).toBeVisible();
});

test("o órgão da conta que abriu a reclamação não é avisado dela", async ({ page }) => {
  const cidade = await prisma.cidade.findFirstOrThrow();
  const autorDoOrgao = await criarOrgaoTeste(cidade.id);
  const outroOrgao = await criarOrgaoTeste(cidade.id);

  // Uma conta do órgão abriu a reclamação: ele não responde ao que ele mesmo abriu.
  const reclamacao = await criarReclamacaoTeste(autorDoOrgao.usuario.id, {
    status: "AGUARDANDO_REVISAO",
    cidadeId: cidade.id,
  });
  idsParaLimpar.push(reclamacao.id);

  await aprovarComoAdmin(page, reclamacao.protocolo);

  await expect
    .poll(async () => notificacoesDeAviso(reclamacao.id))
    .toContain(outroOrgao.usuario.id);
  expect(await notificacoesDeAviso(reclamacao.id)).not.toContain(autorDoOrgao.usuario.id);
});
