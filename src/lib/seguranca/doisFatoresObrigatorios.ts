import type { Papel } from "@/generated/prisma/client";

// Quem publica "resposta oficial" fala em nome de uma prefeitura ou secretaria: uma conta de
// órgão invadida vale mais do que a de um cidadão (e o ranking público depende dela). Por isso
// o segundo fator não é opcional para este papel. Admin e moderador confirmam senha e código a
// cada ação sensível (lib/acoes/confirmarSenha.ts), então o 2FA deles já é exigido onde pesa.
const PAPEIS_COM_DOIS_FATORES_OBRIGATORIOS: readonly Papel[] = ["ORGAO"];

// Onde a conta é levada para ativar: a seção de segurança de "Minha conta".
export const DESTINO_ATIVAR_DOIS_FATORES = "/painel/conta#seguranca";

export function doisFatoresObrigatorio(papel: Papel | undefined): boolean {
  return papel !== undefined && PAPEIS_COM_DOIS_FATORES_OBRIGATORIOS.includes(papel);
}

// A conta precisa ativar o 2FA antes de usar a área de trabalho do papel. `doisFatores` vem da
// sessão (relido do banco a cada leitura, ver o callback jwt em auth.ts): ativar ou desativar
// vale na requisição seguinte, sem novo login.
export function faltaAtivarDoisFatores(usuario: {
  papel?: Papel;
  doisFatores?: boolean;
}): boolean {
  return doisFatoresObrigatorio(usuario.papel) && !usuario.doisFatores;
}
