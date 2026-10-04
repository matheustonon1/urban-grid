"use client";

import { useActionState, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { SeletorCidade } from "@/components/cidade-combobox";
import { SeletorCategoria } from "@/components/categoria-select";
import { useFecharAoInteragirFora } from "@/hooks/useFecharAoInteragirFora";
import { botaoPrimario, campoInput, cartao } from "@/lib/estilos";

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

export function NovaReclamacaoForm({
  categorias,
}: {
  categorias: Categoria[];
}) {
  const t = useTranslations("NovaReclamacao");
  const [state, action, pending] = useActionState(criarReclamacao, undefined);
  const enderecoRef = useRef<HTMLInputElement>(null);
  const bairroRef = useRef<HTMLInputElement>(null);
  const [cidadeAutoPreenchida, setCidadeAutoPreenchida] =
    useState<CidadeResultado | null>(null);
  const [statusCep, setStatusCep] = useState<
    "idle" | "buscando" | "nao-encontrado"
  >("idle");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [imagemAmpliada, setImagemAmpliada] = useState<string | null>(null);
  const imagensInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useFecharAoInteragirFora<HTMLDivElement>(!!imagemAmpliada, () =>
    setImagemAmpliada(null)
  );

  // Reaplica a lista pro <input> nativo via DataTransfer sempre que ela
  // muda (seleção nova ou remoção de uma foto) - não dá pra editar um
  // FileList existente diretamente, só substituir o do input inteiro.
  // Sem isso, remover uma miniatura não removia o arquivo de verdade do
  // que seria enviado no submit.
  function atualizarArquivos(novaLista: File[]) {
    previews.forEach((url) => URL.revokeObjectURL(url));
    setArquivos(novaLista);
    setPreviews(novaLista.map((arquivo) => URL.createObjectURL(arquivo)));

    const dt = new DataTransfer();
    novaLista.forEach((arquivo) => dt.items.add(arquivo));
    if (imagensInputRef.current) {
      imagensInputRef.current.files = dt.files;
    }
  }

  function selecionarImagens(lista: FileList | null) {
    atualizarArquivos(lista ? Array.from(lista) : []);
  }

  function removerImagem(indice: number) {
    atualizarArquivos(arquivos.filter((_, i) => i !== indice));
  }

  async function buscarCep(valorDigitado: string) {
    const cep = valorDigitado.replace(/\D/g, "");
    if (cep.length !== 8) {
      setStatusCep("idle");
      return;
    }

    setStatusCep("buscando");
    try {
      const resposta = await fetch(`/api/cep?cep=${cep}`);
      const dados = await resposta.json();

      if (dados.erro) {
        setStatusCep("nao-encontrado");
        return;
      }

      setStatusCep("idle");
      if (enderecoRef.current && dados.logradouro) {
        enderecoRef.current.value = dados.logradouro;
      }
      if (bairroRef.current && dados.bairro) {
        bairroRef.current.value = dados.bairro;
      }
      if (dados.cidade) {
        setCidadeAutoPreenchida(dados.cidade);
      }
    } catch {
      setStatusCep("nao-encontrado");
    }
  }

  return (
    <form action={action} className={`flex flex-col gap-5 ${cartao}`}>
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
          {t("sobreProblema")}
        </h2>

        <input
          type="text"
          name="titulo"
          placeholder={t("titulo")}
          className={campoInput}
        />
        {state?.erros?.titulo && (
          <p className="text-sm text-red-600 dark:text-red-400">{state.erros.titulo[0]}</p>
        )}

        <textarea
          name="descricao"
          placeholder={t("descrevaProblema")}
          rows={5}
          className={campoInput}
        />
        {state?.erros?.descricao && (
          <p className="text-sm text-red-600 dark:text-red-400">{state.erros.descricao[0]}</p>
        )}

        <SeletorCategoria
          categorias={categorias}
          selecionadaId={categoriaId}
          onSelecionar={setCategoriaId}
          placeholder={t("categoria")}
        />
        {state?.erros?.categoriaId && (
          <p className="text-sm text-red-600 dark:text-red-400">{state.erros.categoriaId[0]}</p>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
        <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
          {t("localizacao")}
        </h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <input
              type="text"
              name="cep"
              required
              placeholder={t("cep")}
              onChange={(evento) => buscarCep(evento.target.value)}
              className={campoInput}
            />
            {statusCep === "buscando" && (
              <p className="text-sm text-slate-500 dark:text-slate-400">{t("buscandoEndereco")}</p>
            )}
            {statusCep === "nao-encontrado" && (
              <p className="text-sm text-amber-600 dark:text-amber-400">{t("cepNaoEncontrado")}</p>
            )}
            {state?.erros?.cep && (
              <p className="text-sm text-red-600 dark:text-red-400">{state.erros.cep[0]}</p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <SeletorCidade
              key={cidadeAutoPreenchida?.id ?? "manual"}
              required
              placeholder={t("cidade")}
              defaultValue={cidadeAutoPreenchida}
            />
            {state?.erros?.cidadeId && (
              <p className="text-sm text-red-600 dark:text-red-400">{state.erros.cidadeId[0]}</p>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <input
              ref={enderecoRef}
              type="text"
              name="endereco"
              placeholder={t("endereco")}
              className={campoInput}
            />
            {state?.erros?.endereco && (
              <p className="text-sm text-red-600 dark:text-red-400">{state.erros.endereco[0]}</p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <input
              ref={bairroRef}
              type="text"
              name="bairro"
              placeholder={t("bairro")}
              className={campoInput}
            />
            {state?.erros?.bairro && (
              <p className="text-sm text-red-600 dark:text-red-400">{state.erros.bairro[0]}</p>
            )}
          </div>
        </div>

        <input
          type="text"
          name="referencia"
          placeholder={t("referencia")}
          className={campoInput}
        />
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
        <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
          {t("fotos")}
        </h2>

        {/* <input type="file"> nativo escondido (sr-only, não display:none -
            continua focável/acionável por teclado) atrás de um label
            estilizado como zona de soltar - o controle nativo do navegador
            destoava muito do resto do formulário. */}
        <label
          htmlFor="imagens-input"
          className="flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-slate-50/60 px-4 py-6 text-center transition-colors hover:border-primary hover:bg-primary/5 dark:border-slate-700 dark:bg-slate-900/40 dark:hover:border-blue-400 dark:hover:bg-blue-500/5"
        >
          <ImagePlus className="h-5 w-5 text-slate-400 dark:text-slate-500" aria-hidden />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {previews.length > 0
              ? t("fotosSelecionadas", { count: previews.length })
              : t("adicionarFotos")}
          </span>
          <span className="text-xs text-slate-400 dark:text-slate-500">{t("ateCincoFotos")}</span>
          <input
            ref={imagensInputRef}
            id="imagens-input"
            type="file"
            name="imagens"
            multiple
            accept="image/jpeg,image/png,image/webp"
            onChange={(evento) => selecionarImagens(evento.target.files)}
            className="sr-only"
          />
        </label>

        {previews.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {previews.map((url, indice) => (
              <div key={url} className="group relative h-20 w-20 shrink-0">
                <button
                  type="button"
                  onClick={() => setImagemAmpliada(url)}
                  className="block h-full w-full overflow-hidden rounded-lg border border-slate-200 transition hover:border-primary dark:border-slate-700 dark:hover:border-blue-400"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- preview local via object URL, não é ativo do Next */}
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </button>
                <button
                  type="button"
                  onClick={() => removerImagem(indice)}
                  aria-label={t("removerFoto")}
                  className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-white shadow transition hover:bg-red-600"
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {imagemAmpliada && (
        <div
          role="dialog"
          aria-modal="true"
          className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
        >
          <div ref={modalRef} className="relative max-h-full max-w-full">
            {/* eslint-disable-next-line @next/next/no-img-element -- preview local via object URL, não é ativo do Next */}
            <img
              src={imagemAmpliada}
              alt=""
              className="max-h-[85vh] max-w-full rounded-lg object-contain"
            />
            <button
              type="button"
              onClick={() => setImagemAmpliada(null)}
              aria-label={t("fecharImagem")}
              className="absolute -top-3 -right-3 flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-900 shadow-lg hover:bg-slate-100"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      )}

      <label className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
        <input
          type="checkbox"
          name="declaracaoVeracidade"
          required
          className="mt-0.5"
        />
        <span>{t("declaracaoVeracidade")}</span>
      </label>
      {state?.erros?.declaracaoVeracidade && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.erros.declaracaoVeracidade[0]}</p>
      )}

      {state?.mensagem && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.mensagem}</p>
      )}

      <button type="submit" disabled={pending} className={botaoPrimario}>
        {t("enviarReclamacao")}
      </button>
    </form>
  );
}
