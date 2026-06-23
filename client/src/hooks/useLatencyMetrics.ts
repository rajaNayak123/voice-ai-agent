/**
 * Thin selector hook exposing just the latency metrics slice of the
 * store, so latency-display components don't re-render on every
 * transcript token (they only care about the metrics object).
 */
import { useConversationStore } from "../store/conversationStore";

export function useLatencyMetrics() {
  return useConversationStore((s) => s.metrics);
}
