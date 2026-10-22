import { getTranslations } from "next-intl/server";

import { verificarSenhaAtual } from "@/lib/conta/senhaAtual";

import { falha, falhaNoDialogo, type ResultadoAcao } from "./resultado";
import { CAMPO_SENHA_CONFIRMACAO } from "./senha";

// Reautenticação para ações que mudam o acesso de OUTRA conta (promover,
// rebaixar, banimento permanente). O diálogo de confirmação protege de um clique
// errado; a senha protege de uma sessão deixada aberta ou roubada - quem a
// usasse podia se tornar admin permanente ou derrubar contas só com o cookie.
//
// Usa o mesmo contador de tentativas do login (verificarSenhaAtual), então não
// vira um jeito de testar senhas sem limite. Devolve `null` quando a senha
// confere; senão, o resultado que a action deve retornar tal qual - antes de
// mexer em qualquer dado.
export async function exigirConfirmacaoDeSenha(
  userId: string,
  formData: FormData
): Promise<ResultadoAcao | null> {
  const t = await getTranslations("Acao");

  const senha = formData.get(CAMPO_SENHA_CONFIRMACAO);
  if (typeof senha !== "string" || senha.length === 0) {
    return falhaNoDialogo(t("senhaObrigatoria"));
  }

  switch (await verificarSenhaAtual(userId, senha)) {
    case "ok":
      return null;
    case "incorreta":
      return falhaNoDialogo(t("senhaIncorreta"));
    case "bloqueada":
      return falhaNoDialogo(t("muitasTentativas"));
    default:
      return falha(t("senhaIndisponivel"));
  }
}
