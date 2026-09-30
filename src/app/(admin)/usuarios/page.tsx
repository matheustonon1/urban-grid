import { getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import { botaoPrimario, botaoSecundario, campoInput, cartao, containerPagina } from "@/lib/estilos";

import { alterarPapelUsuario } from "./actions";
import { PAPEIS_ATRIBUIVEIS } from "./definitions";
import { exigirAdmin } from "../solicitacoes-orgao/exigir-admin";

export default async function UsuariosPage({ searchParams }: PageProps<"/usuarios">) {
  const t = await getTranslations("Usuarios");
  const tPapel = await getTranslations("Papel");
  const session = await exigirAdmin();

  const { q } = await searchParams;
  const termo = typeof q === "string" ? q.trim() : "";

  // ORGAO fica fora da busca (ver comentário em ./definitions) - essa
  // conta não se gerencia por aqui.
  const usuarios =
    termo.length >= 2
      ? await prisma.user.findMany({
          where: {
            papel: { not: "ORGAO" },
            OR: [{ email: { contains: termo } }, { name: { contains: termo } }],
          },
          orderBy: { email: "asc" },
          take: 20,
        })
      : [];

  return (
    <main className={containerPagina}>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {t("titulo")}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t("descricao")}</p>
      </div>

      <form className="flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={termo}
          placeholder={t("buscarPlaceholder")}
          className={`flex-1 ${campoInput}`}
        />
        <button type="submit" className={botaoPrimario}>
          {t("buscar")}
        </button>
      </form>

      {termo.length > 0 && termo.length < 2 && (
        <p className="text-sm text-slate-500 dark:text-slate-400">{t("digiteMais")}</p>
      )}
      {termo.length >= 2 && usuarios.length === 0 && (
        <p className="text-sm text-slate-500 dark:text-slate-400">{t("nenhumEncontrado")}</p>
      )}

      {usuarios.map((usuario) => (
        <div key={usuario.id} className={`flex flex-wrap items-center justify-between gap-3 ${cartao}`}>
          <div>
            <p className="font-medium text-slate-900 dark:text-slate-100">
              {usuario.name ?? usuario.email}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {usuario.email} · {tPapel(usuario.papel)}
            </p>
          </div>

          {usuario.id === session.user.id ? (
            <p className="text-xs italic text-slate-400 dark:text-slate-500">{t("vocêMesmo")}</p>
          ) : (
            <form
              action={alterarPapelUsuario.bind(null, usuario.id)}
              className="flex items-center gap-2"
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
