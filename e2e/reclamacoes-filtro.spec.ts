import { expect, test } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import {
  apagarLogsDeModeracao,
  criarCidadaoTeste,
  criarReclamacaoTeste,
  limparDadosTeste,
} from "./helpers";

let idsParaLimpar: string[] = [];

test.afterAll(async () => {
  await apagarLogsDeModeracao({ id: { in: idsParaLimpar } });
  await prisma.reclamacao.deleteMany({ where: { id: { in: idsParaLimpar } } });
  await limparDadosTeste();
});

async function criarComTitulo(
  autorId: string,
  titulo: string,
  overrides?: Parameters<typeof criarReclamacaoTeste>[1]
) {
  const reclamacao = await criarReclamacaoTeste(autorId, overrides);
  return prisma.reclamacao.update({ where: { id: reclamacao.id }, data: { titulo } });
}

test("categoria e cidade filtram na hora, busca exige o botão, chips removem individualmente, e resolvidas continuam na lista", async ({
  page,
}) => {
  const { usuario } = await criarCidadaoTeste();
  const categorias = await prisma.categoria.findMany({ where: { ativa: true }, take: 2 });
  test.skip(categorias.length < 2, "precisa de ao menos 2 categorias ativas cadastradas");

  const sufixo = Date.now();
  const reclamacaoA = await criarComTitulo(usuario.id, `Filtro E2E A ${sufixo}`, {
    categoriaId: categorias[0].id,
  });
  const reclamacaoB = await criarComTitulo(usuario.id, `Filtro E2E B ${sufixo}`, {
    categoriaId: categorias[1].id,
  });
  const reclamacaoResolvida = await criarComTitulo(usuario.id, `Filtro E2E resolvida ${sufixo}`);
  await prisma.reclamacao.update({
    where: { id: reclamacaoResolvida.id },
    data: { status: "RESOLVIDA" },
  });
  idsParaLimpar = [reclamacaoA.id, reclamacaoB.id, reclamacaoResolvida.id];

  await page.goto("/reclamacoes");

  // Bug corrigido: reclamação já resolvida não sumia da listagem pública.
  await expect(page.getByText(reclamacaoResolvida.titulo)).toBeVisible();

  // Categoria filtra assim que escolhida, sem precisar clicar em "Filtrar".
  await page.getByRole("button", { name: "Todas as categorias" }).click();
  await page.getByRole("option", { name: categorias[0].nome, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`categoriaId=${categorias[0].id}`));
  await expect(page.getByText(reclamacaoA.titulo)).toBeVisible();
  await expect(page.getByText(reclamacaoB.titulo)).not.toBeVisible();

  // O chip da categoria remove só aquele filtro, sem limpar tudo.
  await page.getByRole("button", { name: /Remover filtro/ }).click();
  await expect(page).not.toHaveURL(/categoriaId=/);
  await expect(page.getByText(reclamacaoB.titulo)).toBeVisible();

  // Busca por palavra-chave só filtra depois do clique em "Filtrar" - digitar
  // sozinho não navega.
  await page.getByPlaceholder("Buscar por palavra-chave...").fill(reclamacaoA.titulo);
  await expect(page.getByText(reclamacaoB.titulo)).toBeVisible();
  await page.getByRole("button", { name: "Filtrar" }).click();
  await expect(page).toHaveURL(/q=/);
  await expect(page.getByRole("link", { name: reclamacaoA.titulo })).toBeVisible();
  await expect(page.getByText(reclamacaoB.titulo)).not.toBeVisible();
});
