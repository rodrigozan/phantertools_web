import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "./ui";
import {
  quizDate,
  useQuizFetch,
  type QuizMetrics,
  type QuizMetricVideo,
  type QuizRetention,
} from "../lib/quiz";
import { api } from "../lib/api";
import { youtubeConnectUrl } from "../lib/youtubeChannels";

const nf = new Intl.NumberFormat("pt-BR");

// Variação desde a leitura anterior; não aparece até existirem dois pontos no histórico.
function delta(v: QuizMetricVideo) {
  const h = v.history;
  if (h.length < 2) return null;
  return h[h.length - 1].views - h[h.length - 2].views;
}

const fmtDur = (s: number | null | undefined) =>
  s == null
    ? "—"
    : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

// Curva de retenção em SVG: eixo X = posição no vídeo (0–100%), eixo Y = audiência ainda assistindo.
export function RetentionChart({ url }: { url: string }) {
  const [data, setData] = useState<QuizRetention | null | "loading" | "none">(
    "loading",
  );
  useEffect(() => {
    let live = true;
    api
      .get<QuizRetention>(url)
      .then((r) => live && setData(r.data))
      .catch(() => live && setData("none"));
    return () => {
      live = false;
    };
  }, [url]);
  if (data === "loading")
    return <p className="text-sm text-muted">Carregando retenção…</p>;
  if (data === "none" || !data)
    return (
      <p className="text-sm text-muted">
        Sem dados de retenção para este vídeo ainda.
      </p>
    );
  const max = Math.max(1, ...data.points.map((p) => p.watch));
  const pts = data.points
    .map(
      (p) =>
        `${(p.ratio * 300).toFixed(1)},${(100 - (p.watch / max) * 100).toFixed(1)}`,
    )
    .join(" ");
  return (
    <figure>
      <svg
        viewBox="0 0 300 100"
        className="h-32 w-full"
        role="img"
        aria-label="Curva de retenção da audiência"
        preserveAspectRatio="none"
      >
        <polyline
          points={pts}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          className="text-brand"
        />
      </svg>
      <figcaption className="mt-1 flex justify-between text-xs text-muted">
        <span>Início</span>
        <span>
          Audiência assistindo ao longo do vídeo (pico {(max * 100).toFixed(0)}
          %)
        </span>
        <span>Fim</span>
      </figcaption>
    </figure>
  );
}

export function QuizMetricsPanel() {
  const [open, setOpen] = useState<string | null>(null);
  const { data, error } = useQuizFetch<QuizMetrics>("/quiz/metrics");
  if (error)
    return (
      <p className="mb-6 text-sm text-muted">
        Não foi possível carregar as métricas agora.
      </p>
    );
  if (!data) return null;
  const t = data.totals;
  return (
    <section className="mb-6" aria-label="Desempenho no YouTube">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">Desempenho no YouTube</h2>
        <p className="text-xs text-muted">
          {data.enabled
            ? `Atualizado a cada ${data.intervalHours} h · última leitura ${quizDate(data.lastCheckedAt ?? undefined)}`
            : "Coleta de métricas desativada no servidor."}
        </p>
      </div>
      {!t.videos ? (
        <Card className="p-5 text-sm text-muted">
          As métricas aparecem depois que o primeiro vídeo publicado for lido.
          Testes sem publicação não são medidos.
        </Card>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-4 border-y border-border py-5 lg:grid-cols-4">
            {[
              ["Visualizações", nf.format(t.views)],
              ["Média por vídeo", nf.format(t.avgViews)],
              ["Curtidas", nf.format(t.likes)],
              [
                "Taxa de curtidas",
                t.likeRate === null
                  ? "—"
                  : `${(t.likeRate * 100).toFixed(1).replace(".", ",")}%`,
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-sm text-muted">{label}</dt>
                <dd className="mt-1 text-2xl tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          {!data.analyticsScope ? (
            <p className="mt-3 text-sm text-muted">
              Para ver retenção e tempo assistido, reconecte o canal do YouTube
              e aceite a permissão do Analytics.{" "}
              <a className="text-brand underline" href={youtubeConnectUrl}>
                Reconectar canal
              </a>
            </p>
          ) : data.analyticsTotals.videos > 0 ? (
            <dl className="mt-3 grid grid-cols-2 gap-4 border-b border-border pb-5">
              <div>
                <dt className="text-sm text-muted">Retenção média</dt>
                <dd className="mt-1 text-2xl tabular-nums">
                  {data.analyticsTotals.avgViewPercentage == null
                    ? "—"
                    : `${data.analyticsTotals.avgViewPercentage.toFixed(0)}%`}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Tempo médio assistido</dt>
                <dd className="mt-1 text-2xl tabular-nums">
                  {fmtDur(data.analyticsTotals.avgViewDurationSec)}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-muted">
              Dados do Analytics ainda não disponíveis (costumam levar cerca de
              2 dias).
            </p>
          )}
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="text-left text-muted">
                <tr>
                  <th className="py-2 pr-3 font-normal">Quiz</th>
                  <th className="py-2 pr-3 text-right font-normal">
                    Visualizações
                  </th>
                  <th className="py-2 pr-3 text-right font-normal">
                    Desde a última leitura
                  </th>
                  <th className="py-2 pr-3 text-right font-normal">Curtidas</th>
                  <th className="py-2 pr-3 text-right font-normal">
                    Comentários
                  </th>
                  <th className="py-2 pr-3 text-right font-normal">Retenção</th>
                  <th className="py-2 text-right font-normal">Curva</th>
                </tr>
              </thead>
              <tbody>
                {data.videos.map((v) => {
                  const d = delta(v);
                  return (
                    <Fragment key={v.productionId}>
                      <tr className="border-t border-border">
                        <td className="py-2 pr-3">
                          <Link
                            className="text-brand underline"
                            to={`/quiz/producoes/${v.productionId}`}
                          >
                            {v.topic || v.localDate}
                          </Link>
                          {v.missing && (
                            <span className="ml-2 text-xs text-negative">
                              não encontrado no canal
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {nf.format(v.views)}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {d === null
                            ? "—"
                            : `${d >= 0 ? "+" : ""}${nf.format(d)}`}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {nf.format(v.likes)}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {nf.format(v.comments)}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {v.analytics?.status === "ok" &&
                          v.analytics.avgViewPercentage != null
                            ? `${v.analytics.avgViewPercentage.toFixed(0)}%`
                            : "—"}
                        </td>
                        <td className="py-2 text-right">
                          {v.analytics?.hasRetention ? (
                            <button
                              type="button"
                              className="text-brand underline"
                              aria-expanded={open === v.productionId}
                              onClick={() =>
                                setOpen(
                                  open === v.productionId
                                    ? null
                                    : v.productionId,
                                )
                              }
                            >
                              {open === v.productionId ? "Ocultar" : "Ver"}
                            </button>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                      {open === v.productionId && (
                        <tr>
                          <td colSpan={7} className="pb-4">
                            <RetentionChart url={`/quiz/metrics/${v.productionId}/retention`} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
