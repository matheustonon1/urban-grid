// Site oficial do órgão, informado no pedido de acesso. É texto de quem preenche o formulário: o
// admin o ABRE para conferir o vínculo, então só entra endereço web de verdade (http/https, com
// domínio), nunca `javascript:`, `data:`, IP, `localhost` ou endereço com usuário e senha.

const LIMITE_TAMANHO = 500;

// Devolve o endereço padronizado (sem usuário/senha, consulta ou âncora, em minúsculas no
// domínio e sem barra final) ou null se não serve. Aceita sem o esquema ("saolucas.sp.gov.br"):
// quem digita o site costuma omitir o "https://".
export function normalizarLinkOficial(valor: string): string | null {
  const bruto = valor.trim();
  if (!bruto || bruto.length > LIMITE_TAMANHO) return null;

  // Qualquer coisa com esquema próprio (javascript:, data:, ftp:) é decidida abaixo; o que não
  // tem esquema é tratado como https.
  const temEsquema = /^[a-z][a-z0-9+.-]*:/i.test(bruto) && !/^[^/]*:\d+(\/|$)/.test(bruto);
  let url: URL;
  try {
    url = new URL(temEsquema ? bruto : `https://${bruto}`);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const host = url.hostname.toLowerCase();
  // Precisa de domínio com ponto; IP (v4 ou v6) e "localhost" não são o site de um órgão.
  if (!host.includes(".") || host.startsWith("[") || /^\d+(\.\d+){3}$/.test(host)) return null;
  // Sem rótulo vazio ("a..b", ponto no fim) nem caractere fora do que um domínio aceita.
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host)) return null;

  const caminho = url.pathname.replace(/\/+$/, "");
  const porta = url.port ? `:${url.port}` : "";
  const endereco = `${url.protocol}//${host}${porta}${caminho}`;

  return endereco.length > LIMITE_TAMANHO ? null : endereco;
}

// O domínio do link, para comparar com o do e-mail. Recebe um link já normalizado.
export function hostDoLink(link: string): string {
  try {
    return new URL(link).hostname.toLowerCase();
  } catch {
    return "";
  }
}
