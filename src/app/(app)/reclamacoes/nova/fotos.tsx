"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, ScanFace, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Aviso } from "@/components/ui/aviso";
import { useFecharAoInteragirFora } from "@/hooks/useFecharAoInteragirFora";
import { MAX_IMAGENS, MAX_TAMANHO_BYTES, TIPOS_ACEITOS } from "@/lib/reclamacoes/limitesImagem";

function formatarTamanho(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(Math.round(bytes / 1024), 1)} KB`;
}

function mesmoArquivo(a: File, b: File) {
  return a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;
}

// Escolha das fotos: zona de soltar + miniaturas. A lista vive no pai (que a
// anexa ao envio), aqui só se valida e se mostra. Os limites são os do
// servidor (limitesImagemReclamacao), avisados na hora de escolher; a
// validação de verdade continua lá - isto é só feedback mais cedo.
export function FotosReclamacao({
  arquivos,
  onMudar,
}: {
  arquivos: File[];
  onMudar: (arquivos: File[]) => void;
}) {
  const t = useTranslations("NovaReclamacao");
  const [aviso, setAviso] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [ampliada, setAmpliada] = useState<string | null>(null);
  const modalRef = useFecharAoInteragirFora<HTMLDivElement>(!!ampliada, () => setAmpliada(null));
  const inputRef = useRef<HTMLInputElement>(null);

  const previews = useMemo(() => arquivos.map((arquivo) => URL.createObjectURL(arquivo)), [arquivos]);
  useEffect(() => {
    return () => previews.forEach((url) => URL.revokeObjectURL(url));
  }, [previews]);

  // Soma às fotos que já estão na lista (escolher de novo não apaga as
  // anteriores) e ignora a mesma foto escolhida duas vezes.
  function adicionar(novos: File[]) {
    if (novos.length === 0) return;

    const avisos: string[] = [];
    const validos = novos.filter((arquivo) => {
      if (!TIPOS_ACEITOS.includes(arquivo.type)) {
        avisos.push(t("avisoTipoInvalido", { nome: arquivo.name }));
        return false;
      }
      if (arquivo.size > MAX_TAMANHO_BYTES) {
        avisos.push(
          t("avisoTamanhoExcedido", {
            nome: arquivo.name,
            tamanho: (arquivo.size / (1024 * 1024)).toFixed(1),
          })
        );
        return false;
      }
      return !arquivos.some((existente) => mesmoArquivo(existente, arquivo));
    });

    if (arquivos.length + validos.length > MAX_IMAGENS) {
      setAviso(t("erroMaxImagens", { max: MAX_IMAGENS }));
      return;
    }

    setAviso(avisos.length > 0 ? avisos.join(" ") : null);
    if (validos.length > 0) onMudar([...arquivos, ...validos]);
  }

  // Fotos escolhidas antes de a página terminar de hidratar: o evento change
  // passou sem ninguém ouvindo e o <input> nativo ficou com os arquivos, mas a
  // tela não mostrava nada (e o envio ia sem elas). Na montagem, recolhe o que
  // já estiver no controle.
  useEffect(() => {
    const input = inputRef.current;
    const jaEscolhidas = Array.from(input?.files ?? []);
    if (input && jaEscolhidas.length > 0) {
      adicionar(jaEscolhidas);
      input.value = "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só na montagem
  }, []);

  function remover(indice: number) {
    setAviso(null);
    onMudar(arquivos.filter((_, i) => i !== indice));
  }

  const cheio = arquivos.length >= MAX_IMAGENS;

  return (
    <div className="flex flex-col gap-3">
      {/* <input type="file"> nativo escondido (sr-only, não display:none -
          continua focável/acionável por teclado) atrás do rótulo estilizado
          como zona de soltar. */}
      <label
        htmlFor="imagens-input"
        onDragOver={(evento) => {
          evento.preventDefault();
          if (!cheio) setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(evento) => {
          evento.preventDefault();
          setArrastando(false);
          adicionar(Array.from(evento.dataTransfer.files));
        }}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-7 text-center transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary ${
          arrastando
            ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-500/10"
            : "border-slate-300 bg-slate-50/60 hover:border-blue-400 hover:bg-blue-50/50 dark:border-slate-700 dark:bg-slate-900/40 dark:hover:border-blue-400 dark:hover:bg-blue-500/5"
        } ${cheio ? "pointer-events-none opacity-60" : ""}`}
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-blue-700 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-blue-300 dark:ring-slate-700">
          <ImagePlus className="h-5 w-5" aria-hidden />
        </span>
        <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
          {arquivos.length > 0
            ? t("fotosSelecionadas", { count: arquivos.length })
            : t("adicionarFotos")}
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {arrastando ? t("solteParaAdicionar") : cheio ? t("limiteDeFotos") : t("arrasteOuClique")}
        </span>
        <span className="text-xs text-slate-400 dark:text-slate-500">{t("ateCincoFotos")}</span>
        <input
          ref={inputRef}
          id="imagens-input"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          disabled={cheio}
          onChange={(evento) => {
            adicionar(Array.from(evento.target.files ?? []));
            // Limpa o controle nativo: a lista de verdade está no estado, e
            // sem isto escolher a mesma foto de novo (depois de removê-la)
            // não dispararia o onChange.
            evento.target.value = "";
          }}
          className="sr-only"
        />
      </label>

      {aviso && <Aviso tom="atencao">{aviso}</Aviso>}

      {previews.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {previews.map((url, indice) => (
            <li key={url} className="flex min-w-0 flex-col gap-1.5">
              <div className="group relative aspect-4/3">
                <button
                  type="button"
                  onClick={() => setAmpliada(url)}
                  className="block h-full w-full overflow-hidden rounded-lg border border-slate-200 transition hover:border-primary dark:border-slate-700 dark:hover:border-blue-400"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- preview local via object URL, não é ativo do Next */}
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </button>
                <button
                  type="button"
                  onClick={() => remover(indice)}
                  aria-label={t("removerFoto")}
                  className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-slate-700 text-white shadow transition hover:bg-red-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                <span className="text-slate-700 dark:text-slate-300">{arquivos[indice].name}</span>
                <span className="font-mono tabular-nums"> · {formatarTamanho(arquivos[indice].size)}</span>
              </p>
            </li>
          ))}
        </ul>
      )}

      <p className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
        <ScanFace className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>{t("avisoDesfoque")}</span>
      </p>

      {ampliada && (
        <div
          role="dialog"
          aria-modal="true"
          className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
        >
          <div ref={modalRef} className="relative max-h-full max-w-full">
            {/* eslint-disable-next-line @next/next/no-img-element -- preview local via object URL, não é ativo do Next */}
            <img
              src={ampliada}
              alt=""
              className="max-h-[85vh] max-w-full rounded-lg object-contain"
            />
            <button
              type="button"
              onClick={() => setAmpliada(null)}
              aria-label={t("fecharImagem")}
              className="absolute -top-3 -right-3 flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-900 shadow-lg hover:bg-slate-100"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
