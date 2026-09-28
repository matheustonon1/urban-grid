"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";

import { exigirAdmin } from "../solicitacoes-orgao/exigir-admin";

export async function atualizarCategoriasOrgao(orgaoId: string, formData: FormData) {
  await exigirAdmin();

  const categoriaIds = [
    ...new Set(formData.getAll("categoriaIds").filter((v): v is string => typeof v === "string")),
  ];

  const orgao = await prisma.orgao.findUnique({ where: { id: orgaoId } });
  if (!orgao) return;

  if (categoriaIds.length > 0) {
    // Formulário desatualizado (categoria removida entre carregar a
    // página e salvar) ou id adulterado - sem isto, o `set` abaixo
    // lançava P2025 não tratado (500) ao referenciar uma categoria que
    // não existe (mais).
    const categoriasValidas = await prisma.categoria.count({
      where: { id: { in: categoriaIds } },
    });
    if (categoriasValidas !== categoriaIds.length) {
      return;
    }
  }

  await prisma.orgao.update({
    where: { id: orgaoId },
    data: { categorias: { set: categoriaIds.map((id) => ({ id })) } },
  });

  revalidatePath("/orgaos-categorias");
}

// Único jeito de desligar Orgao.ativo hoje - sem isto, o campo era
// checado em vários lugares (bloqueia resposta oficial de órgão inativo,
// filtra listagens públicas em cidades/orgaos) mas nada na aplicação
// nunca escrevia nele: um órgão extinto ou cadastrado por engano não
// tinha como ser desativado sem mexer direto no banco.
export async function alternarAtivoOrgao(orgaoId: string, novoAtivo: boolean) {
  await exigirAdmin();

  await prisma.orgao.update({
    where: { id: orgaoId },
    data: { ativo: novoAtivo },
  });

  revalidatePath("/orgaos-categorias");
}
