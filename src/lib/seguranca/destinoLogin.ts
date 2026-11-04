import type { Papel } from "@/generated/prisma/client";

import { DESTINO_ATIVAR_DOIS_FATORES, faltaAtivarDoisFatores } from "./doisFatoresObrigatorios";

// Para onde o login leva. O `callbackUrl` vem da query string - qualquer um pode escrever
// `/login?callbackUrl=https://golpe.com` num link -, então só vale um caminho INTERNO:
// URL absoluta, `//host` (protocolo relativo) e barra invertida (alguns navegadores a
// tratam como `/`) seriam open redirect. Tab e quebra de linha também ficam de fora: o
// navegador os descarta ao interpretar a URL, e `/\t/golpe.com` viraria `//golpe.com`.
// Login e cadastro não são destino: mandariam a pessoa de volta ao formulário que acabou
// de usar.
export function caminhoInternoSeguro(valor: unknown): string | null {
  if (typeof valor !== "string") return null;

  const caminho = valor.trim();
  if (!caminho.startsWith("/") || caminho.startsWith("//")) return null;
  if (caminho.includes("\\") || /[\u0000-\u001f\u007f]/.test(caminho)) return null;

  const rota = caminho.split(/[?#]/)[0];
  if (rota === "/login" || rota.startsWith("/login/")) return null;
  if (rota === "/cadastro" || rota.startsWith("/cadastro/")) return null;

  return caminho;
}

// Quem chegou pedindo uma página volta a ela; quem entrou direto cai na própria casa: a
// conta de órgão trabalha em /orgao (o /painel é a lista de reclamações de cidadão, onde ela
// nem registra nada).
//
// Órgão sem o segundo fator não usa o painel (ver doisFatoresObrigatorios): vai direto ao lugar
// onde o ativa. Levá-lo a /orgao para o guard devolvê-lo dali funciona, mas, quando o destino é
// renderizado dentro da própria server action de login, a barra de endereço ficaria em /orgao
// com a tela de "Minha conta".
export function destinoPosLogin(
  papel: Papel | undefined,
  callbackUrl: unknown,
  doisFatores: boolean
): string {
  const destino =
    caminhoInternoSeguro(callbackUrl) ?? (papel === "ORGAO" ? "/orgao" : "/painel");

  const vaiParaOPainelDoOrgao = destino.split(/[?#]/)[0] === "/orgao";
  if (vaiParaOPainelDoOrgao && faltaAtivarDoisFatores({ papel, doisFatores })) {
    return DESTINO_ATIVAR_DOIS_FATORES;
  }

  return destino;
}
