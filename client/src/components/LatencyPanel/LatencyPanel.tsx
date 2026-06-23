/**
 * Latency telemetry strip: STT latency, LLM first-token time, TTS
 * first-audio time, and total end-to-end latency for the most recent
 * turn. Rendered as a row of labeled mono-numerals — explicitly framed
 * as instrumentation, not a marketing stat, since the brief calls for
 * visible latency metrics as a transparency/debugging feature.
 */
import type { PipelineMetrics } from "../../types";
import "./LatencyPanel.css";

interface Props {
  metrics: PipelineMetrics;
}

function fmt(ms?: number): string {
  return ms === undefined ? "—" : `${Math.round(ms)} ms`;
}

export function LatencyPanel({ metrics }: Props) {
  const rows: { label: string; value: string; key: keyof PipelineMetrics }[] = [
    { label: "STT latency", value: fmt(metrics.sttFinalMs), key: "sttFinalMs" },
    { label: "LLM first token", value: fmt(metrics.llmFirstTokenMs), key: "llmFirstTokenMs" },
    { label: "TTS server start", value: fmt(metrics.ttsFirstAudioMs), key: "ttsFirstAudioMs" },
    { label: "Audio play start", value: fmt(metrics.clientAudioStartMs), key: "clientAudioStartMs" },
    { label: "Total latency", value: fmt(metrics.totalLatencyMs), key: "totalLatencyMs" },
  ];

  return (
    <div className="latency-panel" aria-label="Pipeline latency metrics">
      {rows.map((row) => (
        <div key={row.key} className={`latency-panel__row ${row.key === "totalLatencyMs" ? "latency-panel__row--total" : ""}`}>
          <span className="latency-panel__label">{row.label}</span>
          <span className="latency-panel__value">{row.value}</span>
        </div>
      ))}
    </div>
  );
}
