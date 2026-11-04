import type { PoolConfig } from "mariadb";

// Traduz a DATABASE_URL (formato do Prisma, a mesma que o CLI lê em prisma.config.ts) para a
// configuração do pool do driver `mariadb`, usado pelo adapter do Prisma 7. O CLI continua
// entendendo a URL do jeito dele; este arquivo só cobre o client da aplicação.
//
//   mysql://usuario:senha@host:3306/banco?sslaccept=strict&connection_limit=5&connect_timeout=10
//
// Parâmetros da URL que contam (os mesmos nomes do Prisma, para a URL de produção não mudar):
// - sslaccept=strict            TLS validando o certificado do servidor (TiDB Cloud exige TLS);
// - sslaccept=accept_invalid_certs   TLS sem validar o certificado;
// - ssl=true | sslmode=require|verify-ca|verify-full   TLS validando o certificado (formato comum
//   em outros provedores);
// - connection_limit            conexões no pool (padrão 5: cada instância serverless tem o seu);
// - connect_timeout             segundos para abrir a conexão (padrão 10; o do driver, 1 s, é
//   curto para um banco remoto que acorda de frio);
// - allowPublicKeyRetrieval=true  só para MySQL local sem TLS com a autenticação padrão do 8.x.
//
// Sem nenhum parâmetro de TLS a conexão é sem TLS, o que serve ao MySQL local (Docker) e ao do CI.

const CONEXOES_PADRAO = 5;
const SEGUNDOS_PARA_CONECTAR_PADRAO = 10;

function inteiroPositivo(valor: string | null, padrao: number): number {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : padrao;
}

export function configDoAdapter(urlDeConexao: string): PoolConfig {
  const url = new URL(urlDeConexao);
  const parametros = url.searchParams;

  const sslaccept = parametros.get("sslaccept");
  const sslmode = parametros.get("sslmode")?.toLowerCase();
  const tlsComValidacao =
    sslaccept === "strict" ||
    parametros.get("ssl") === "true" ||
    sslmode === "require" ||
    sslmode === "verify-ca" ||
    sslmode === "verify-full";
  const tlsSemValidacao = sslaccept === "accept_invalid_certs";

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, "")),
    connectionLimit: inteiroPositivo(parametros.get("connection_limit"), CONEXOES_PADRAO),
    connectTimeout:
      inteiroPositivo(parametros.get("connect_timeout"), SEGUNDOS_PARA_CONECTAR_PADRAO) * 1000,
    ...(tlsComValidacao
      ? { ssl: { rejectUnauthorized: true } }
      : tlsSemValidacao
        ? { ssl: { rejectUnauthorized: false } }
        : {}),
    ...(parametros.get("allowPublicKeyRetrieval") === "true"
      ? { allowPublicKeyRetrieval: true }
      : {}),
  };
}
