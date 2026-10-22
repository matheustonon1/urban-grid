"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { Check, CircleAlert, LoaderCircle, Send } from "lucide-react";
import { useTranslations } from "next-intl";

import { Aviso } from "@/components/ui/aviso";
import { SeletorCidade } from "@/components/formulario/cidade-combobox";
import { botaoPrimario, campoInput, campoInputInvalido } from "@/lib/estilos";

import { Campo, descritoPor } from "@/components/formulario/campo";
import { FotosReclamacao } from "./fotos";
import {
  DepoisDeEnviar,
  DicasReclamacao,
  ListaDeDicas,
  ProgressoPreenchimento,
  type ChaveEtapa,
} from "./lateral";
import { SecaoFormulario } from "./secao-formulario";
import { SeletorCategorias } from "./seletor-categorias";
import { criarReclamacao } from "./actions";

interface Categoria {
  id: string;
  nome: string;
  icone: string | null;
}

interface CidadeResultado {
  id: string;
  nome: string;
  uf: string;
}

// Limites do schema (definitions.ts), repetidos aqui só pra os contadores e o
// progresso; quem decide de verdade é o servidor.
const TITULO_MIN = 10;
const TITULO_MAX = 180;
const DESCRICAO_MIN = 30;
const DESCRICAO_MAX = 3000;

function formatarCep(valor: string) {
  const digitos = valor.replace(/\D/g, "").slice(0, 8);
  return digitos.length > 5 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : digitos;
}

export function NovaReclamacaoForm({
  categorias,
  cidadePadrao,
}: {
  categorias: Categoria[];
  cidadePadrao: CidadeResultado | null;
}) {
  const t = useTranslations("NovaReclamacao");
  const [state, acao, pending] = useActionState(criarReclamacao, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const mensagemRef = useRef<HTMLDivElement>(null);
  const buscaCepRef = useRef(0);

  // Campos controlados: alimentam os contadores e o progresso ao lado.
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [cep, setCep] = useState("");
  const [cidadeId, setCidadeId] = useState(cidadePadrao?.id ?? "");
  const [endereco, setEndereco] = useState("");
  const [bairro, setBairro] = useState("");
  const [referencia, setReferencia] = useState("");
  const [declaracao, setDeclaracao] = useState(false);
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [cidadeAutoPreenchida, setCidadeAutoPreenchida] = useState<CidadeResultado | null>(null);
  const [statusCep, setStatusCep] = useState<
    "idle" | "buscando" | "preenchido" | "nao-encontrado"
  >("idle");

  const erros = state?.erros ?? {};
  const quantidadeErros = Object.keys(erros).length;

  // Depois de um envio com erro, leva o foco ao primeiro campo com problema
  // (ou à mensagem geral): sem isso a pessoa clica em "Enviar", nada parece
  // acontecer e o erro está duas telas acima.
  useEffect(() => {
    if (!state) return;
    const primeiroInvalido = formRef.current?.querySelector<HTMLElement>(
      '[aria-invalid="true"], [data-invalido="true"] input'
    );
    if (primeiroInvalido) {
      primeiroInvalido.focus({ preventScroll: true });
      primeiroInvalido.scrollIntoView({ block: "center", behavior: "smooth" });
    } else {
      mensagemRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [state]);

  // Envia por onSubmit + startTransition, e não por <form action={...}>: o
  // React 19 reinicia o formulário quando uma ação passada em `action`
  // termina - mesmo com erro de validação -, o que apagava o que a pessoa
  // tinha escrito e desmarcava a declaração e a categoria. As fotos vêm do
  // estado, não do <input> nativo.
  function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const formData = new FormData(evento.currentTarget);
    formData.delete("imagens");
    for (const arquivo of arquivos) formData.append("imagens", arquivo);
    startTransition(() => acao(formData));
  }

  async function buscarCep(valorDigitado: string) {
    const digitos = valorDigitado.replace(/\D/g, "");
    const busca = ++buscaCepRef.current;
    if (digitos.length !== 8) {
      setStatusCep("idle");
      return;
    }

    setStatusCep("buscando");
    try {
      const resposta = await fetch(`/api/cep?cep=${digitos}`);
      const dados = await resposta.json();
      // Resposta de um CEP que a pessoa já trocou: descarta.
      if (busca !== buscaCepRef.current) return;

      if (dados.erro) {
        setStatusCep("nao-encontrado");
        return;
      }

      setStatusCep("preenchido");
      if (dados.logradouro) setEndereco(dados.logradouro);
      if (dados.bairro) setBairro(dados.bairro);
      if (dados.cidade) {
        setCidadeAutoPreenchida(dados.cidade);
        setCidadeId(dados.cidade.id);
      }
    } catch {
      if (busca === buscaCepRef.current) setStatusCep("nao-encontrado");
    }
  }

  const etapas: { chave: ChaveEtapa; ok: boolean }[] = [
    { chave: "titulo", ok: titulo.trim().length >= TITULO_MIN },
    { chave: "descricao", ok: descricao.trim().length >= DESCRICAO_MIN },
    { chave: "categoria", ok: categoriaId !== "" },
    {
      chave: "local",
      ok:
        cep.replace(/\D/g, "").length === 8 &&
        cidadeId !== "" &&
        endereco.trim().length >= 5 &&
        bairro.trim().length >= 1,
    },
    { chave: "declaracao", ok: declaracao },
  ];

  const classe = (invalido: boolean) => (invalido ? campoInputInvalido : campoInput);
  const contador = (atual: number, minimo: number, maximo: number) => (
    <span
      aria-hidden
      className={`font-mono text-xs tabular-nums ${
        atual > 0 && atual < minimo
          ? "text-warn-ink"
          : "text-ink-muted"
      }`}
    >
      {atual}/{maximo}
    </span>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start">
      <form ref={formRef} onSubmit={enviar} className="flex min-w-0 flex-col gap-5">
        <details className="rounded-lg border border-line bg-surface px-4 py-3 lg:hidden">
          <summary className="cursor-pointer text-sm font-medium text-ink-2">
            {t("dicasTitulo")}
          </summary>
          <div className="pt-3">
            <ListaDeDicas />
          </div>
        </details>

        {quantidadeErros > 0 && (
          <Aviso tom="erro">{t("revisarCampos", { count: quantidadeErros })}</Aviso>
        )}

        <SecaoFormulario
          id="secao-problema"
          numero={1}
          titulo={t("sobreProblema")}
          descricao={t("sobreProblemaDesc")}
        >
          <Campo
            id="nova-titulo"
            rotulo={t("titulo")}
            dica={t("dicaTitulo")}
            erro={erros.titulo?.[0]}
            contador={contador(titulo.length, TITULO_MIN, TITULO_MAX)}
          >
            <input
              id="nova-titulo"
              type="text"
              name="titulo"
              value={titulo}
              onChange={(evento) => setTitulo(evento.target.value)}
              maxLength={TITULO_MAX}
              placeholder={t("exemploTitulo")}
              aria-invalid={erros.titulo ? true : undefined}
              aria-describedby={descritoPor("nova-titulo", erros.titulo?.[0], t("dicaTitulo"))}
              className={classe(!!erros.titulo)}
            />
          </Campo>

          <Campo
            id="nova-descricao"
            rotulo={t("descrevaProblema")}
            dica={t("dicaDescricao", { min: DESCRICAO_MIN })}
            erro={erros.descricao?.[0]}
            contador={contador(descricao.length, DESCRICAO_MIN, DESCRICAO_MAX)}
          >
            <textarea
              id="nova-descricao"
              name="descricao"
              value={descricao}
              onChange={(evento) => setDescricao(evento.target.value)}
              maxLength={DESCRICAO_MAX}
              rows={6}
              placeholder={t("exemploDescricao")}
              aria-invalid={erros.descricao ? true : undefined}
              aria-describedby={descritoPor(
                "nova-descricao",
                erros.descricao?.[0],
                t("dicaDescricao", { min: DESCRICAO_MIN })
              )}
              className={`${classe(!!erros.descricao)} resize-y leading-relaxed`}
            />
          </Campo>

          <SeletorCategorias
            categorias={categorias}
            selecionadaId={categoriaId}
            onSelecionar={setCategoriaId}
            rotulo={t("categoria")}
            dica={t("dicaCategoria")}
            erro={erros.categoriaId?.[0]}
          />
        </SecaoFormulario>

        <SecaoFormulario
          id="secao-local"
          numero={2}
          titulo={t("localizacao")}
          descricao={t("localizacaoDesc")}
        >
          <div className="grid gap-4 sm:grid-cols-[11rem_minmax(0,1fr)]">
            <Campo
              id="nova-cep"
              rotulo={t("cep")}
              erro={erros.cep?.[0]}
              dica={
                statusCep === "buscando"
                  ? t("buscandoEndereco")
                  : statusCep === "preenchido"
                    ? t("enderecoPreenchido")
                    : statusCep === "nao-encontrado"
                      ? t("cepNaoEncontrado")
                      : t("dicaCep")
              }
            >
              <div className="relative">
                <input
                  id="nova-cep"
                  type="text"
                  name="cep"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  required
                  value={cep}
                  onChange={(evento) => {
                    setCep(formatarCep(evento.target.value));
                    buscarCep(evento.target.value);
                  }}
                  placeholder="00000-000"
                  aria-invalid={erros.cep ? true : undefined}
                  aria-describedby={descritoPor("nova-cep", erros.cep?.[0], "dica")}
                  className={`w-full pr-9 font-mono tabular-nums ${classe(!!erros.cep)}`}
                />
                <span aria-hidden className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                  {statusCep === "buscando" && (
                    <LoaderCircle className="h-4 w-4 animate-spin text-ink-muted" />
                  )}
                  {statusCep === "preenchido" && (
                    <Check className="h-4 w-4 text-ok-ink" strokeWidth={3} />
                  )}
                  {statusCep === "nao-encontrado" && (
                    <CircleAlert className="h-4 w-4 text-warn-ink" />
                  )}
                </span>
              </div>
            </Campo>

            <Campo id="nova-cidade" rotulo={t("cidade")} erro={erros.cidadeId?.[0]}>
              {/* O CEP sempre vale mais que a cidade padrão da conta: a key
                  muda de "padrao" pro id da cidade do CEP e remonta o campo,
                  mesmo que seja a mesma cidade (e mesmo que a pessoa já
                  tenha trocado a cidade na mão). */}
              <SeletorCidade
                key={cidadeAutoPreenchida?.id ?? "padrao"}
                id="nova-cidade"
                required
                placeholder={t("cidade")}
                defaultValue={cidadeAutoPreenchida ?? cidadePadrao}
                onMudar={(cidade) => setCidadeId(cidade?.id ?? "")}
              />
            </Campo>
          </div>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_14rem]">
            <Campo id="nova-endereco" rotulo={t("endereco")} erro={erros.endereco?.[0]}>
              <input
                id="nova-endereco"
                type="text"
                name="endereco"
                autoComplete="street-address"
                value={endereco}
                onChange={(evento) => setEndereco(evento.target.value)}
                placeholder={t("exemploEndereco")}
                aria-invalid={erros.endereco ? true : undefined}
                aria-describedby={descritoPor("nova-endereco", erros.endereco?.[0])}
                className={classe(!!erros.endereco)}
              />
            </Campo>

            <Campo id="nova-bairro" rotulo={t("bairro")} erro={erros.bairro?.[0]}>
              <input
                id="nova-bairro"
                type="text"
                name="bairro"
                value={bairro}
                onChange={(evento) => setBairro(evento.target.value)}
                placeholder={t("exemploBairro")}
                aria-invalid={erros.bairro ? true : undefined}
                aria-describedby={descritoPor("nova-bairro", erros.bairro?.[0])}
                className={classe(!!erros.bairro)}
              />
            </Campo>
          </div>

          <Campo
            id="nova-referencia"
            rotulo={t("referencia")}
            opcional={t("opcional")}
            dica={t("dicaReferencia")}
          >
            <input
              id="nova-referencia"
              type="text"
              name="referencia"
              value={referencia}
              onChange={(evento) => setReferencia(evento.target.value)}
              placeholder={t("exemploReferencia")}
              aria-describedby={descritoPor("nova-referencia", undefined, "dica")}
              className={campoInput}
            />
          </Campo>
        </SecaoFormulario>

        <SecaoFormulario
          id="secao-fotos"
          numero={3}
          titulo={t("fotos")}
          descricao={t("fotosDesc")}
        >
          <FotosReclamacao arquivos={arquivos} onMudar={setArquivos} />
        </SecaoFormulario>

        <SecaoFormulario
          id="secao-envio"
          numero={4}
          titulo={t("confirmacao")}
          descricao={t("confirmacaoDesc")}
        >
          <label
            className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-3 text-sm transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand ${
              erros.declaracaoVeracidade
                ? "border-danger-ink/60 bg-danger-soft/50"
                : "border-line bg-sunken/60"
            }`}
          >
            <input
              type="checkbox"
              name="declaracaoVeracidade"
              required
              checked={declaracao}
              onChange={(evento) => setDeclaracao(evento.target.checked)}
              aria-invalid={erros.declaracaoVeracidade ? true : undefined}
              className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
            />
            <span className="leading-relaxed text-ink-2">
              {t("declaracaoVeracidade")}
            </span>
          </label>
          {erros.declaracaoVeracidade && (
            <p role="alert" className="flex items-start gap-1.5 text-sm text-danger-ink">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {erros.declaracaoVeracidade[0]}
            </p>
          )}

          <div ref={mensagemRef}>
            {state?.mensagem && <Aviso tom="erro">{state.mensagem}</Aviso>}
          </div>

          <div className="flex flex-col gap-2.5">
            <button type="submit" disabled={pending} aria-busy={pending} className={`${botaoPrimario} w-full py-2.5`}>
              {pending ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                  {t("enviando")}
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" aria-hidden />
                  {t("enviarReclamacao")}
                </>
              )}
            </button>
            <p role="status" className="text-center text-xs text-ink-muted">
              {pending ? t("enviandoAviso") : t("avisoModeracao")}
            </p>
          </div>
        </SecaoFormulario>
      </form>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-20">
        <div className="hidden lg:block">
          <ProgressoPreenchimento etapas={etapas} />
        </div>
        <div className="hidden lg:block">
          <DicasReclamacao />
        </div>
        <DepoisDeEnviar />
      </aside>
    </div>
  );
}
