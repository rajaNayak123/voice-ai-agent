/**
 * Thin selector hook exposing conversation history plus the
 * currently-in-progress (not yet finalized) turn pieces: the live STT
 * partial transcript and the streaming LLM response. Components that
 * render the conversation feed use this single hook rather than reaching
 * into the store directly in several places.
 */
import { useConversationStore } from "../store/conversationStore";

export function useConversationHistory() {
  const history = useConversationStore((s) => s.history);
  const partialTranscript = useConversationStore((s) => s.partialTranscript);
  const streamingResponse = useConversationStore((s) => s.streamingResponse);
  const agentState = useConversationStore((s) => s.agentState);

  return { history, partialTranscript, streamingResponse, agentState };
}
