// Limitador simples em memória, por processo - suficiente pra uma instância
// única (como este projeto roda hoje). Não serve como limite global se o
// app rodar em múltiplas instâncias/funções serverless independentes, já
// que cada uma teria seu próprio contador; para esses casos precisaria de
// um armazenamento compartilhado (ex.: Redis).
interface Registro {
  contagem: number;
  expiraEm: number;
}

const registros = new Map<string, Registro>();
const LIMITE_ENTRADAS_ANTES_DE_LIMPAR = 10_000;

function limparExpirados(agora: number) {
  for (const [chave, registro] of registros) {
    if (registro.expiraEm <= agora) {
      registros.delete(chave);
    }
  }
}

// Retorna true se a chave (IP, e-mail, etc.) excedeu o limite de chamadas
// na janela de tempo. Sem chave identificável, não há como limitar - deixa
// passar, mesmo critério usado nos outros limites por IP do projeto
// (cadastro, solicitação de órgão).
export function excedeuLimitePorIp(
  escopo: string,
  chaveIdentificadora: string | null,
  limite: number,
  janelaMs: number
): boolean {
  if (!chaveIdentificadora) return false;

  const agora = Date.now();
  if (registros.size > LIMITE_ENTRADAS_ANTES_DE_LIMPAR) {
    limparExpirados(agora);
  }

  const chave = `${escopo}:${chaveIdentificadora}`;
  const registro = registros.get(chave);

  if (!registro || registro.expiraEm <= agora) {
    registros.set(chave, { contagem: 1, expiraEm: agora + janelaMs });
    return false;
  }

  registro.contagem += 1;
  return registro.contagem > limite;
}
