/**
 * Renders one conversation turn (user or assistant) as a chat-log style
 * row. Uses monospace for the actual spoken text — this is a transcript,
 * not prose copy, and the mono face reinforces "this is what was
 * literally said/heard" the same way the latency numbers do.
 */
import type { ConversationTurn } from "../../types";
import "./TranscriptBubble.css";

interface Props {
  turn: ConversationTurn;
}

const LANG_TAG: Record<string, string> = {
  en: "EN",
  hi: "HI",
  hinglish: "HI-EN",
};

export function TranscriptBubble({ turn }: Props) {
  const isUser = turn.role === "user";
  return (
    <div className={`transcript-bubble transcript-bubble--${turn.role}`}>
      <div className="transcript-bubble__meta">
        <span className="transcript-bubble__role">{isUser ? "You" : "NovaVoice"}</span>
        {turn.language && <span className="transcript-bubble__lang">{LANG_TAG[turn.language]}</span>}
        <span className="transcript-bubble__time">
          {new Date(turn.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
      <p className={`transcript-bubble__text ${turn.isPartial ? "transcript-bubble__text--partial" : ""}`}>
        {turn.content}
      </p>
    </div>
  );
}
