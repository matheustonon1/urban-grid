// Gera prisma/dados/ibge-localidades.json: estados e municípios, como a API do IBGE os devolve.
//
//   npx tsx prisma/gerar-snapshot-ibge.ts
//
// Por que o arquivo existe: o seed baixava a geografia da API do IBGE a cada execução, e a API dá
// timeout de conexão a partir dos runners do GitHub Actions (visto no primeiro job `e2e`), o que
// derrubava o CI por um motivo que não é do código. Com o arquivo, o seed funciona sem rede
// (`SEED_IBGE=local`, usado no CI) e volta a ele sozinho se a API falhar. Os municípios mudam
// raramente (criação e extinção de município); rode este script quando isso importar e commite o
// resultado.
import fs from "fs";
import path from "path";

const IBGE_BASE = "https://servicodados.ibge.gov.br/api/v1/localidades";

interface EstadoIbge {
  id: number;
  sigla: string;
  nome: string;
}
interface MunicipioIbge {
  id: number;
  nome: string;
}

async function buscarJson<T>(url: string): Promise<T> {
  const resposta = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!resposta.ok) throw new Error(`Falha ao buscar ${url}: ${resposta.status}`);
  return resposta.json() as Promise<T>;
}

async function main() {
  const estados = await buscarJson<EstadoIbge[]>(`${IBGE_BASE}/estados?orderBy=nome`);

  const linhas: string[] = [];
  let totalMunicipios = 0;
  for (const estado of estados) {
    const municipios = await buscarJson<MunicipioIbge[]>(
      `${IBGE_BASE}/estados/${estado.sigla}/municipios?orderBy=nome`
    );
    totalMunicipios += municipios.length;
    // Só o que o seed usa, uma linha por estado: o diff de uma atualização fica legível.
    linhas.push(
      JSON.stringify({
        id: estado.id,
        sigla: estado.sigla,
        nome: estado.nome,
        municipios: municipios.map((m) => ({ id: m.id, nome: m.nome })),
      })
    );
  }

  const destino = path.join(process.cwd(), "prisma", "dados", "ibge-localidades.json");
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  const cabecalho = JSON.stringify({
    fonte: IBGE_BASE,
    geradoEm: new Date().toISOString().slice(0, 10),
  }).slice(0, -1);
  fs.writeFileSync(destino, `${cabecalho},"estados":[\n${linhas.join(",\n")}\n]}\n`);

  console.log(`${estados.length} estados e ${totalMunicipios} municípios gravados em ${destino}`);
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
