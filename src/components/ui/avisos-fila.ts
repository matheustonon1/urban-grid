// Regra da pilha de avisos flutuantes (components/ui/avisos.tsx), à parte para poder ser
// testada sem navegador.

interface AvisoDaFila {
  tipo: string;
  mensagem: string;
}

// Avisos de erro e de atenção ficam na tela até serem fechados, então quem tenta de novo
// uma ação recusada empilhava o MESMO texto a cada tentativa até o limite da pilha. Um aviso
// idêntico (mesmo tom e mesma mensagem) a outro ainda visível não entra de novo.
export function empilharAviso<A extends AvisoDaFila>(atuais: A[], novo: A, maximo: number): A[] {
  if (atuais.some((aviso) => aviso.tipo === novo.tipo && aviso.mensagem === novo.mensagem)) {
    return atuais;
  }
  return [...atuais, novo].slice(-maximo);
}
