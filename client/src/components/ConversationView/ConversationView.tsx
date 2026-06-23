/**
 * Renders the full conversation feed: finalized turns from history, plus
 * the two "live" in-progress pieces that aren't in history yet — the
 * partial (interim) STT transcript while the user is still speaking, and
 * the streaming LLM response as it's generated token-by-token. Both live
 * pieces render as a lighter/dashed variant of a transcript bubble so
 * it's visually clear they're still in flux.
 */
import { useEffect, useRef } from "react";
import { TranscriptBubble } from "../TranscriptBubble/TranscriptBubble";
import type { ConversationTurn } from "../../types";
import "./ConversationView.css";

interface Props {
  history: ConversationTurn[];
  partialTranscript: string;
  streamingResponse: string;
}

export function ConversationView({ history, partialTranscript, streamingResponse }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [history.length, partialTranscript, streamingResponse]);

  const isEmpty = history.length === 0 && !partialTranscript && !streamingResponse;

  return (
    <div className="conversation-view" ref={scrollRef}>
      {isEmpty && (
        <div className="conversation-view__empty">
          <p>Start a conversation and ask about NovaDesk — pricing, features, or support.</p>
          <p className="conversation-view__empty-sub">"NovaDesk ki pricing kya hai?" works too.</p>
        </div>
      )}

      {history.map((turn) => (
        <TranscriptBubble key={turn.id} turn={turn} />
      ))}

      {partialTranscript && (
        <TranscriptBubble
          turn={{
            id: "live-partial",
            role: "user",
            content: partialTranscript,
            timestamp: Date.now(),
            isPartial: true,
          }}
        />
      )}

      {streamingResponse && (
        <TranscriptBubble
          turn={{
            id: "live-streaming",
            role: "assistant",
            content: streamingResponse,
            timestamp: Date.now(),
            isPartial: true,
          }}
        />
      )}
    </div>
  );
}
