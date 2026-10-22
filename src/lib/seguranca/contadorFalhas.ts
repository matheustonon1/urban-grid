import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

// Técnica de contador de força bruta compartilhada entre login por senha
// (loginSeguranca.ts) e código TOTP (totp.ts) - mesmo algoritmo (incremento
// atômico, checa limite, zera e aplica bloqueio temporário) com campos e
// limites diferentes pra cada um. Um lugar só pra essa técnica, em vez de
// duas cópias que podiam divergir silenciosamente numa correção futura
// (ex.: envolver as duas escritas numa transação).
type CampoTentativas = "loginTentativasFalhas" | "totpTentativasFalhas";
type CampoBloqueio = "loginBloqueadoAte" | "totpBloqueadoAte";

export function criarContadorDeFalhas<CT extends CampoTentativas, CB extends CampoBloqueio>(opcoes: {
  campoTentativas: CT;
  campoBloqueio: CB;
  limiteTentativas: number;
  bloqueioMs: number;
}) {
  function estaBloqueado(usuario: Record<CB, Date | null>): boolean {
    const bloqueadoAte = usuario[opcoes.campoBloqueio];
    return !!bloqueadoAte && bloqueadoAte > new Date();
  }

  // Incremento atômico no banco (Prisma `increment`), não leitura-depois-
  // escrita a partir de um valor lido antes pelo chamador - senão
  // tentativas concorrentes leem o mesmo contador desatualizado e todas
  // escrevem "valor lido + 1", deixando o contador bem menor que o número
  // real de tentativas e o bloqueio nunca dispara sob força bruta paralela.
  async function registrarFalha(userId: string): Promise<void> {
    const dadosIncremento = {
      [opcoes.campoTentativas]: { increment: 1 },
    } as Prisma.UserUpdateInput;

    const usuario = (await prisma.user.update({
      where: { id: userId },
      data: dadosIncremento,
      select: { [opcoes.campoTentativas]: true },
    })) as unknown as Record<CT, number>;

    if (usuario[opcoes.campoTentativas] >= opcoes.limiteTentativas) {
      const dadosBloqueio = {
        [opcoes.campoTentativas]: 0,
        [opcoes.campoBloqueio]: new Date(Date.now() + opcoes.bloqueioMs),
      } as Prisma.UserUpdateInput;

      await prisma.user.update({ where: { id: userId }, data: dadosBloqueio });
    }
  }

  async function resetarFalhas(userId: string): Promise<void> {
    const dados = {
      [opcoes.campoTentativas]: 0,
      [opcoes.campoBloqueio]: null,
    } as Prisma.UserUpdateInput;

    await prisma.user.update({ where: { id: userId }, data: dados });
  }

  return { estaBloqueado, registrarFalha, resetarFalhas };
}
