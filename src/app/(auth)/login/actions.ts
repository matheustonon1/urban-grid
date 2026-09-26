"use server";

import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { getTranslations } from "next-intl/server";

import { signIn } from "@/auth";
import { gastarTempoDeComparacao } from "@/lib/hashFalso";
import { buscarUsuarioPorIdentificador } from "@/lib/identificador";
import { usuarioBloqueadoPorLogin } from "@/lib/loginSeguranca";

export type LoginFormState =
  | {
      erro?: string;
      etapaTotp?: boolean;
      identificador?: string;
    }
  | undefined;

export async function login(
  _state: LoginFormState,
  formData: FormData
): Promise<LoginFormState> {
  const t = await getTranslations("Login");
  const identificador = formData.get("identificador");
  const senha = formData.get("senha");
  const codigoTotp = formData.get("codigoTotp");

  if (typeof identificador !== "string" || typeof senha !== "string") {
    return { erro: t("erroCamposObrigatorios") };
  }
  if (identificador.length > 254 || senha.length > 100) {
    return { erro: t("erroCredenciaisInvalidas") };
  }

  const usuario = await buscarUsuarioPorIdentificador(identificador);
  if (usuario?.banidoAte && usuario.banidoAte > new Date()) {
    return { erro: t("erroContaSuspensa") };
  }
  if (usuario && usuarioBloqueadoPorLogin(usuario)) {
    return { erro: t("erroMuitasTentativas") };
  }

  // Pré-checagem só de UX: mostra o campo de código antes de tentar,
  // pra não fazer o usuário digitar a senha de novo. Quem realmente
  // barra o login sem 2FA válido é o authorize() em auth.ts. Só decide
  // isso depois de confirmar a senha - senão dá pra descobrir se uma
  // conta existe e tem 2FA ativado testando identificadores com senha
  // errada, sem nunca precisar acertá-la (enumeração de conta).
  if (!usuario?.senhaHash) {
    await gastarTempoDeComparacao(senha);
  }
  const senhaValida =
    !!usuario?.senhaHash && (await bcrypt.compare(senha, usuario.senhaHash));
  const precisaTotp = senhaValida && !!usuario?.totpConfirmadoEm;
  if (precisaTotp && (typeof codigoTotp !== "string" || codigoTotp.trim() === "")) {
    return { identificador, etapaTotp: true };
  }

  try {
    await signIn("credentials", {
      identificador,
      senha,
      codigoTotp: typeof codigoTotp === "string" ? codigoTotp : undefined,
      redirectTo: "/painel",
    });
  } catch (erro) {
    if (erro instanceof AuthError) {
      return {
        erro: precisaTotp
          ? t("erroCredenciaisOuCodigoInvalidos")
          : t("erroCredenciaisInvalidas"),
        identificador,
        etapaTotp: precisaTotp,
      };
    }
    throw erro;
  }
}
