
import { useConversationStore } from "../store/conversationStore";

export function useConversationHistory() {
  const history = useConversationStore((s) => s.history);
  const partialTranscript = useConversationStore((s) => s.partialTranscript);
  const streamingResponse = useConversationStore((s) => s.streamingResponse);
  const agentState = useConversationStore((s) => s.agentState);

  return { history, partialTranscript, streamingResponse, agentState };
}
