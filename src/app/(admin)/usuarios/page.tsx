import { Search, SearchX } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import { AvatarIniciais } from "@/components/avatar-iniciais";
import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { EstadoVazio } from "@/components/estado-vazio";
import { Selo } from "@/components/selo";
import { botaoPrimario, botaoSecundario, campoInput, cartao, containerPagina } from "@/lib/estilos";
import { metadataDaPagina } from "@/lib/metadata";

import { alterarPapelUsuario } from "./actions";
import { PAPEIS_ATRIBUIVEIS } from "./definitions";
import { exigirAdmin } from "../solicitacoes-orgao/exigir-admin";

export const generateMetadata = metadataDaPagina("Usuarios");

const TOM_PAPEL = { ADMIN: "info", MODERADOR: "atencao", CIDADAO: "neutro", ORGAO: "neutro" } as const;

export default async function UsuariosPage({ searchParams }: PageProps<"/usuarios">) {
  const t = await getTranslations("Usuarios");
  const tPapel = await getTranslations("Papel");
  const session = await exigirAdmin();

  const { q } = await searchParams;
  const termo = typeof q === "string" ? q.trim() : "";
  const buscando = termo.length >= 2;

  // ORGAO fica fora da busca (ver comentário em ./definitions) - essa
  // conta não se gerencia por aqui. Sem busca, a tela mostra a equipe atual
  // (moderadores e admins): antes era só um campo de texto numa página vazia,
  // e quem entrava pra ver "quem tem acesso elevado" não via nada.
  const usuarios = await prisma.user.findMany({
    where: buscando
      ? {
          papel: { not: "ORGAO" },
          OR: [{ email: { contains: termo } }, { name: { contains: termo } }],
        }
      : { papel: { in: ["ADMIN", "MODERADOR"] } },
    orderBy: buscando ? { email: "asc" } : [{ papel: "asc" }, { email: "asc" }],
    take: buscando ? 20 : 50,
  });

  return (
    <main className={`${containerPagina} max-w-3xl`}>
      <CabecalhoPagina titulo={t("titulo")} descricao={t("descricao")} />

      <form className="flex gap-2" role="search">
        <label htmlFor="busca-usuario" className="sr-only">
          {t("buscarPlaceholder")}
        </label>
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            id="busca-usuario"
            type="text"
            name="q"
            defaultValue={termo}
            placeholder={t("buscarPlaceholder")}
            className={`w-full pl-9 ${campoInput}`}
          />
        </div>
        <button type="submit" className={botaoPrimario}>
          {t("buscar")}
        </button>
      </form>

      {termo.length > 0 && termo.length < 2 && (
        <p className="text-sm text-slate-500 dark:text-slate-400">{t("digiteMais")}</p>
      )}

      {!buscando && termo.length === 0 && usuarios.length > 0 && (
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {t("equipe")} ({usuarios.length})
        </h2>
      )}

      {buscando && usuarios.length === 0 && (
        <EstadoVazio icone={SearchX} titulo={t("nenhumEncontrado")} />
      )}

      {usuarios.map((usuario) => (
        <div
          key={usuario.id}
          className={`flex flex-wrap items-center gap-3 ${cartao}`}
        >
          <AvatarIniciais nome={usuario.name ?? usuario.email} />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-slate-900 dark:text-slate-100">
              {usuario.name ?? usuario.email}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{usuario.email}</p>
          </div>
          {usuario.id === session.user.id ? (
            <>
              {/* Sem select aqui: o papel atual aparece como selo (nas outras
                  linhas o próprio select já mostra o papel). */}
              <Selo tom={TOM_PAPEL[usuario.papel]}>{tPapel(usuario.papel)}</Selo>
              <p className="w-full pl-11 text-xs italic text-slate-400 dark:text-slate-500">
                {t("vocêMesmo")}
              </p>
            </>
          ) : (
            <form
              action={alterarPapelUsuario.bind(null, usuario.id)}
              className="flex w-full items-center gap-2 sm:w-auto"
            >
              <select name="papel" defaultValue={usuario.papel} className={campoInput}>
                {PAPEIS_ATRIBUIVEIS.map((papel) => (
                  <option key={papel} value={papel}>
                    {tPapel(papel)}
                  </option>
                ))}
              </select>
              <button type="submit" className={botaoSecundario}>
                {t("salvar")}
              </button>
            </form>
          )}
        </div>
      ))}
    </main>
  );
}
