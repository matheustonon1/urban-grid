"use server";

import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { getTranslations } from "next-intl/server";

import { signIn } from "@/auth";
import { destinoPosLogin } from "@/lib/seguranca/destinoLogin";
import { gastarTempoDeComparacao } from "@/lib/seguranca/hashFalso";
import { buscarUsuarioPorIdentificador } from "@/lib/conta/identificador";
import { usuarioBloqueadoPorLogin } from "@/lib/seguranca/loginSeguranca";

// O que a ação devolve ao navegador. De propósito NÃO carrega a senha nem o identificador: o
// formulário guarda o que a pessoa digitou só no próprio navegador (ver formulario.tsx) para não
// pedi-lo de novo no passo do código. Antes a senha voltava aqui, em texto, na resposta da ação
// - trafegava de volta, aparecia no payload da resposta e ficava em memória do cliente sem
// necessidade.
export type LoginFormState =
  | {
      erro?: string;
      // true = a senha conferiu e a conta tem 2FA: o formulário mostra o campo do código.
      // Só é verdadeiro DEPOIS de acertar a senha (senão revelaria que a conta existe e usa 2FA).
      etapaTotp?: boolean;
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
    return { etapaTotp: true };
  }

  try {
    await signIn("credentials", {
      identificador,
      senha,
      codigoTotp: typeof codigoTotp === "string" ? codigoTotp : undefined,
      // O papel vem do cadastro lido acima; só vale se a senha conferir (o signIn
      // recusa antes de redirecionar). O caminho pedido passa pelo filtro de
      // caminho interno - nunca vai direto da query string para o redirecionamento.
      redirectTo: destinoPosLogin(
        usuario?.papel,
        formData.get("callbackUrl"),
        Boolean(usuario?.totpConfirmadoEm)
      ),
    });
  } catch (erro) {
    if (erro instanceof AuthError) {
      return {
        erro: precisaTotp
          ? t("erroCredenciaisOuCodigoInvalidos")
          : t("erroCredenciaisInvalidas"),
        // Código errado com a senha certa: o campo do código continua. Senha errada: volta ao
        // formulário simples, sem campo de 2FA.
        etapaTotp: precisaTotp,
      };
    }
    throw erro;
  }
}
