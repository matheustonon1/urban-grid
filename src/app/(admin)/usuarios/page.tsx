import { SearchX } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import { Campo } from "@/components/formulario/campo";
import { AvatarIniciais } from "@/components/ui/avatar-iniciais";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { BotaoAcao, FormularioAcao } from "@/components/ui/formulario-acao";
import { ResumoLateral } from "@/components/ui/resumo-lateral";
import { Secao } from "@/components/ui/secao";
import { Selo } from "@/components/ui/selo";
import {
  botaoPrimario,
  botaoSecundario,
  campoInput,
  cartaoSecao,
  colunaFiltros,
  colunaResultados,
  grade,
  pagina,
} from "@/lib/estilos";
import { metadataDaPagina } from "@/lib/metadata";

import { alterarPapelUsuario } from "./actions";
import { PAPEIS_ATRIBUIVEIS } from "./definitions";
import { exigirAdmin } from "../solicitacoes-orgao/exigir-admin";

export const generateMetadata = metadataDaPagina("Usuarios");

const TOM_PAPEL = { ADMIN: "info", MODERADOR: "atencao", CIDADAO: "neutro", ORGAO: "neutro" } as const;

export default async function UsuariosPage({ searchParams }: PageProps<"/usuarios">) {
  const t = await getTranslations("Usuarios");
  const tPapel = await getTranslations("Papel");
  const tNav = await getTranslations("AdminNav");
  const session = await exigirAdmin();

  const { q } = await searchParams;
  const termo = typeof q === "string" ? q.trim() : "";
  const buscando = termo.length >= 2;

  // ORGAO fica fora da busca (ver comentário em ./definitions) - essa
  // conta não se gerencia por aqui. Sem busca, a tela mostra a equipe atual
  // (moderadores e admins): antes era só um campo de texto numa página vazia,
  // e quem entrava pra ver "quem tem acesso elevado" não via nada.
  const [usuarios, equipe] = await Promise.all([
    prisma.user.findMany({
      where: buscando
        ? {
            papel: { not: "ORGAO" },
            OR: [{ email: { contains: termo } }, { name: { contains: termo } }],
          }
        : { papel: { in: ["ADMIN", "MODERADOR"] } },
      orderBy: buscando ? { email: "asc" } : [{ papel: "asc" }, { email: "asc" }],
      take: buscando ? 20 : 50,
    }),
    prisma.user.groupBy({
      by: ["papel"],
      where: { papel: { in: ["ADMIN", "MODERADOR"] } },
      _count: { _all: true },
    }),
  ]);
  const contagemEquipe = new Map(equipe.map((linha) => [linha.papel, linha._count._all]));
  const totalEquipe = (contagemEquipe.get("ADMIN") ?? 0) + (contagemEquipe.get("MODERADOR") ?? 0);

  return (
    <main className={pagina}>
      <CabecalhoPagina
        kicker={tNav("kickerAdmin")}
        titulo={t("titulo")}
        descricao={t("descricao")}
      />

      <div className={grade}>
        <aside className={colunaFiltros}>
          <form role="search" className={`flex flex-col gap-4 ${cartaoSecao}`}>
            <Campo
              id="busca-usuario"
              rotulo={t("buscarRotulo")}
              dica={termo.length > 0 && !buscando ? t("digiteMais") : undefined}
            >
              <input
                id="busca-usuario"
                type="text"
                name="q"
                defaultValue={termo}
                className={campoInput}
              />
            </Campo>
            <button type="submit" className={botaoPrimario}>
              {t("buscar")}
            </button>
          </form>

          <ResumoLateral
            rotulo={t("resumoRotulo")}
            valor={totalEquipe}
            itens={[
              { rotulo: t("resumoAdmins"), valor: contagemEquipe.get("ADMIN") ?? 0 },
              { rotulo: t("resumoModeradores"), valor: contagemEquipe.get("MODERADOR") ?? 0 },
            ]}
          />
        </aside>

        <div className={colunaResultados}>
          <Secao
            id="usuarios"
            titulo={buscando ? t("resultados") : t("equipe")}
            contador={usuarios.length}
          >
            {buscando && usuarios.length === 0 && (
              <EstadoVazio icone={SearchX} titulo={t("nenhumEncontrado")} />
            )}

            {usuarios.length > 0 && (
              <ul className="-mt-2 divide-y divide-line">
                {usuarios.map((usuario) => (
                  <li key={usuario.id} className="flex flex-wrap items-center gap-3 py-4">
                    <AvatarIniciais nome={usuario.name ?? usuario.email} />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-ink">{usuario.name ?? usuario.email}</p>
                      <p className="text-sm text-ink-muted">{usuario.email}</p>
                    </div>
                    {usuario.id === session.user.id ? (
                      // Sem select aqui: o papel atual aparece como selo (nas outras
                      // linhas o próprio select já mostra o papel). Numa linha própria,
                      // pra não espremer o e-mail.
                      <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 pl-11">
                        <Selo tom={TOM_PAPEL[usuario.papel]}>{tPapel(usuario.papel)}</Selo>
                        <p className="text-xs text-ink-muted italic">{t("vocêMesmo")}</p>
                      </div>
                    ) : (
                      <FormularioAcao
                        action={alterarPapelUsuario.bind(null, usuario.id)}
                        className="flex w-full items-center gap-2 sm:w-auto"
                        confirmacao={{
                          titulo: t("confirmarTitulo", { nome: usuario.name ?? usuario.email }),
                          // {papel} é o campo do formulário: o diálogo troca pelo rótulo da opção marcada.
                          descricao: t("confirmarDescricao", {
                            nome: usuario.name ?? usuario.email,
                            atual: tPapel(usuario.papel),
                            papel: "{papel}",
                          }),
                          detalhes: [t("detalheModerador"), t("detalheAdmin"), t("detalheCidadao")],
                          confirmar: t("confirmarBotao", { papel: "{papel}" }),
                          tom: "primario",
                          // Sem mudança de papel não há o que confirmar: o servidor responde "nada foi alterado".
                          soSeMudar: "papel",
                          // Muda o que a conta pode fazer: pede a senha de quem está alterando.
                          senha: true,
                        }}
                      >
                        <select
                          name="papel"
                          defaultValue={usuario.papel}
                          aria-label={t("papelDe", { nome: usuario.name ?? usuario.email })}
                          className={campoInput}
                        >
                          {PAPEIS_ATRIBUIVEIS.map((papel) => (
                            <option key={papel} value={papel}>
                              {tPapel(papel)}
                            </option>
                          ))}
                        </select>
                        <BotaoAcao className={botaoSecundario}>{t("salvar")}</BotaoAcao>
                      </FormularioAcao>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Secao>
        </div>
      </div>
    </main>
  );
}
