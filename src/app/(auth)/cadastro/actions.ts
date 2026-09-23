"use server";

import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import { signIn } from "@/auth";
import { hashCpf } from "@/lib/cpf";
import { criarTokenVerificacao, enviarEmailVerificacao } from "@/lib/email";
import { verificarTurnstile } from "@/lib/turnstile";

import { criarCadastroSchema, type CadastroFormState } from "./definitions";

const LIMITE_CONTAS_POR_IP_HORA = 3;

export async function cadastrar(
  _state: CadastroFormState,
  formData: FormData
): Promise<CadastroFormState> {
  const t = await getTranslations("Cadastro");
  const validado = criarCadastroSchema(t).safeParse({
    nome: formData.get("nome"),
    email: formData.get("email"),
    cpf: formData.get("cpf"),
    senha: formData.get("senha"),
    confirmarSenha: formData.get("confirmarSenha"),
    aceitaTermos: formData.get("aceitaTermos"),
  });

  if (!validado.success) {
    return { erros: validado.error.flatten().fieldErrors };
  }

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const turnstileOk = await verificarTurnstile(
    formData.get("cf-turnstile-response") as string | null,
    ip
  );
  if (!turnstileOk) {
    return { mensagem: t("erroTurnstile") };
  }

  if (ip) {
    const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000);
    const contasRecentes = await prisma.user.count({
      where: { criadoDeIp: ip, createdAt: { gte: umaHoraAtras } },
    });
    if (contasRecentes >= LIMITE_CONTAS_POR_IP_HORA) {
      return { mensagem: t("erroLimiteContas") };
    }
  }

  const { nome, email, cpf, senha } = validado.data;
  const senhaHash = await bcrypt.hash(senha, 10);
  const cpfHash = hashCpf(cpf);

  try {
    await prisma.user.create({
      data: {
        name: nome,
        email,
        cpfHash,
        senhaHash,
        papel: "CIDADAO",
        termosAceitosEm: new Date(),
        criadoDeIp: ip,
      },
    });
  } catch (erro) {
    if (
      erro instanceof Prisma.PrismaClientKnownRequestError &&
      erro.code === "P2002"
    ) {
      // No MySQL, `meta.target` vem como o nome do índice (string), não
      // como array de colunas (isso muda por provider no Prisma) — por
      // isso a checagem cobre os dois formatos.
      const alvo = erro.meta?.target;
      const colidiuComCpf = Array.isArray(alvo)
        ? alvo.includes("cpfHash")
        : typeof alvo === "string" && alvo.toLowerCase().includes("cpf");

      if (colidiuComCpf) {
        return { erros: { cpf: [t("erroCpfDuplicado")] } };
      }
      return { erros: { email: [t("erroEmailDuplicado")] } };
    }
    throw erro;
  }

  const token = await criarTokenVerificacao(email);
  await enviarEmailVerificacao({ email, token });

  try {
    await signIn("credentials", {
      identificador: email,
      senha,
      redirectTo: "/painel",
    });
  } catch (erro) {
    if (erro instanceof AuthError) {
      return { mensagem: t("erroLoginAutomatico") };
    }
    throw erro;
  }
}
