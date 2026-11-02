import { getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import { verificarSenhaAtual } from "@/lib/conta/senhaAtual";
import {
  codigoTotpValido,
  consumirCodigoBackup,
  decifrarSegredoTotp,
  registrarFalhaTotp,
  reservarTimeStepTotp,
  resetarFalhasTotp,
  usuarioBloqueadoPorTotp,
} from "@/lib/seguranca/totp";

import { falha, falhaNoDialogo, type ResultadoAcao } from "./resultado";
import { CAMPO_CODIGO_CONFIRMACAO, CAMPO_SENHA_CONFIRMACAO } from "./senha";

// Reautenticação para ações que mudam o acesso de OUTRA conta ou concedem voz oficial
// (promover, rebaixar, banimento permanente, aprovar um órgão). O diálogo de
// confirmação protege de um clique errado; senha E código de duas etapas protegem de
// uma sessão deixada aberta ou roubada - quem só tivesse o cookie podia se tornar admin
// permanente, derrubar contas ou criar um "órgão" falso.
//
// Dois fatores, nesta ordem:
// 1. a senha da conta, no mesmo contador de tentativas do login (verificarSenhaAtual),
//    então isto não vira um jeito de testar senhas sem limite;
// 2. o código do aplicativo autenticador (ou um código de backup). Conta SEM 2FA
//    ativado não passa: a ação exige o segundo fator, e a tela manda ativá-lo. O código
//    de aplicativo é de uso único dentro do passo de 30 s (reservarTimeStepTotp, o mesmo
//    do login) - o que o login gastou não vale aqui - e tem o mesmo bloqueio por erro.
//
// Devolve `null` quando tudo confere; senão, o resultado que a action deve retornar tal
// qual - antes de mexer em qualquer dado.
export async function exigirReautenticacao(
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
      break;
    case "incorreta":
      return falhaNoDialogo(t("senhaIncorreta"));
    case "bloqueada":
      return falhaNoDialogo(t("muitasTentativas"));
    default:
      return falha(t("senhaIndisponivel"));
  }

  const usuario = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      totpSecret: true,
      totpConfirmadoEm: true,
      totpUltimoTimeStep: true,
      totpBloqueadoAte: true,
    },
  });
  if (!usuario?.totpConfirmadoEm || !usuario.totpSecret) {
    return falha(t("segundoFatorNecessario"));
  }
  if (await usuarioBloqueadoPorTotp(usuario)) {
    return falhaNoDialogo(t("muitasTentativas"));
  }

  const codigo = formData.get(CAMPO_CODIGO_CONFIRMACAO);
  if (typeof codigo !== "string" || codigo.trim().length === 0) {
    return falhaNoDialogo(t("codigoObrigatorio"));
  }

  const segredo = decifrarSegredoTotp(usuario.totpSecret);
  const resultado = await codigoTotpValido(
    segredo,
    codigo,
    usuario.totpUltimoTimeStep ?? undefined
  );

  let valido = false;
  if (resultado.valido) {
    // A leitura acima não impede duas tentativas simultâneas com o mesmo código: a
    // reserva atômica do passo decide qual vence; quem perde conta como código gasto.
    valido =
      resultado.timeStep === undefined ||
      (await reservarTimeStepTotp(userId, resultado.timeStep));
    if (!valido) {
      return falhaNoDialogo(t("codigoJaUsado"));
    }
  } else {
    // O código pode estar certo e já ter sido gasto (o do login vale pelo mesmo passo de
    // 30 s): isso é "espere o próximo código", não um erro de digitação, e não conta
    // para o bloqueio - senão entrar e confirmar logo em seguida trancaria a conta.
    if ((await codigoTotpValido(segredo, codigo)).valido) {
      return falhaNoDialogo(t("codigoJaUsado"));
    }
    valido = await consumirCodigoBackup(userId, codigo);
  }

  if (!valido) {
    await registrarFalhaTotp(userId);
    return falhaNoDialogo(t("codigoIncorreto"));
  }

  await resetarFalhasTotp(userId);
  return null;
}
