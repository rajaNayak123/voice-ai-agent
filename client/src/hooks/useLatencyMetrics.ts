
import { useConversationStore } from "../store/conversationStore";

export function useLatencyMetrics() {
  return useConversationStore((s) => s.metrics);
}
