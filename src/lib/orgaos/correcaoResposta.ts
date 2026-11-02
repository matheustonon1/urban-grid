// Corrigir uma resposta oficial.
//
// A resposta oficial é registro público: uma promessa de prazo ou "foi resolvido" que o órgão
// pudesse reescrever à vontade deixaria de ser registro. Por isso a correção é só para o erro
// de quem acabou de enviar (typo, data errada), nunca para mudar o que foi dito depois de lido:
//
// - numa janela curta depois do envio;
// - só a MAIS RECENTE da reclamação (se saiu outra depois, ela já responde a esta);
// - só enquanto o autor não avaliou a resolução que ela anunciou;
// - só por quem é do órgão que respondeu.
//
// Passada a janela, o caminho é enviar uma nova resposta com a correção: a anterior continua
// visível e a linha do tempo mostra as duas. E a correção nunca é silenciosa: a resposta
// aparece marcada como editada.
export const JANELA_CORRECAO_MS = 15 * 60 * 1000;

export type MotivoSemCorrecao = "outroOrgao" | "janela" | "outraResposta" | "avaliada";

export function motivoSemCorrecao({
  resposta,
  orgaoIdDoUsuario,
  agora,
  haRespostaPosterior,
  avaliadaDepois,
}: {
  resposta: { orgaoId: string; createdAt: Date };
  orgaoIdDoUsuario: string | null | undefined;
  agora: Date;
  haRespostaPosterior: boolean;
  avaliadaDepois: boolean;
}): MotivoSemCorrecao | null {
  if (!orgaoIdDoUsuario || resposta.orgaoId !== orgaoIdDoUsuario) return "outroOrgao";
  if (agora.getTime() - resposta.createdAt.getTime() > JANELA_CORRECAO_MS) return "janela";
  if (haRespostaPosterior) return "outraResposta";
  if (avaliadaDepois) return "avaliada";
  return null;
}

// Até quando a correção vale, para a tela dizer a hora em vez de deixar a pessoa adivinhar.
export function limiteDaCorrecao(criadaEm: Date): Date {
  return new Date(criadaEm.getTime() + JANELA_CORRECAO_MS);
}
