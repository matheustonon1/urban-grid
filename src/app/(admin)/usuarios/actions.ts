"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import { exigirConfirmacaoDeSenha } from "@/lib/acoes/confirmarSenha";
import { falha, informacao, sucesso, type ResultadoAcao } from "@/lib/acoes/resultado";
import { criarNotificacao } from "@/lib/notificacoes";

import { criarAlterarPapelSchema } from "./definitions";
import { exigirAdmin } from "../solicitacoes-orgao/exigir-admin";

// Único jeito de alguém virar MODERADOR/ADMIN hoje era escrever direto no
// banco (seed ou acesso manual) - não existia nenhuma tela pra promover
// (ou rebaixar) um usuário pela própria aplicação.
//
// Muda o que uma conta PODE fazer, então tem três travas além do guard de
// admin: não vale para a própria conta, exige a senha de quem está agindo
// (confirmação no diálogo da tela, conferida aqui de novo) e a pessoa afetada
// recebe um aviso no sininho - privilégio nunca muda em silêncio.
export async function alterarPapelUsuario(
  userId: string,
  formData: FormData
): Promise<ResultadoAcao> {
  const session = await exigirAdmin();
  const t = await getTranslations("Usuarios");
  const tPapel = await getTranslations("Papel");

  // Bloqueia alterar o próprio papel em vez de tentar prever todo caso de
  // borda de "é o último admin?" - mais simples e mais seguro: qualquer
  // mudança de privilégio de uma conta passa pelo crivo de outra pessoa,
  // nunca só de quem seria afetado por ela.
  if (userId === session.user.id) {
    return falha(t("vocêMesmo"));
  }

  const validado = criarAlterarPapelSchema(t).safeParse({ papel: formData.get("papel") });
  if (!validado.success) {
    return falha(validado.error.issues[0]?.message ?? t("erroPapelInvalido"));
  }
  const novoPapel = validado.data.papel;

  const usuario = await prisma.user.findUnique({ where: { id: userId } });
  // ORGAO fica de fora daqui (ver comentário em ./definitions) - nada a
  // fazer com uma conta desse papel nesta tela.
  if (!usuario || usuario.papel === "ORGAO") {
    return falha(t("erroUsuarioIndisponivel"));
  }

  const nome = usuario.name ?? usuario.email;
  if (usuario.papel === novoPapel) {
    return informacao(t("papelInalterado", { nome, papel: tPapel(novoPapel) }));
  }

  const senhaErrada = await exigirConfirmacaoDeSenha(session.user.id, formData);
  if (senhaErrada) {
    return senhaErrada;
  }

  // O papel lido acima na condição: se outro admin mexeu nesta conta entre o
  // findUnique e aqui, ou ela virou conta de órgão, nada é gravado.
  const atualizacao = await prisma.user.updateMany({
    where: { id: userId, papel: usuario.papel },
    data: { papel: novoPapel },
  });
  if (atualizacao.count === 0) {
    return falha(t("erroUsuarioIndisponivel"));
  }

  await criarNotificacao({
    userId,
    tipo: "CONTA_SEGURANCA",
    // O papel vai cru (MODERADOR...) e o texto o traduz no idioma de quem recebe.
    texto: { chave: "papelAlterado", params: { papel: novoPapel } },
  });

  revalidatePath("/usuarios");

  return sucesso(t("papelAlterado", { nome, papel: tPapel(novoPapel) }));
}
