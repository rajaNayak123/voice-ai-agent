/**
 * Shows the knowledge-base chunks retrieved for the most recent query,
 * with their similarity scores and source file. This is a transparency
 * feature: it lets a developer or curious user see exactly what grounded
 * the agent's last answer (or confirm nothing was retrieved, which is
 * why the agent said it didn't have the information).
 */
import type { RetrievedChunk } from "../../types";
import "./RagPanel.css";

interface Props {
  chunks: RetrievedChunk[];
}

export function RagPanel({ chunks }: Props) {
  return (
    <div className="rag-panel">
      <div className="rag-panel__header">
        <span>Knowledge base grounding</span>
        <span className="rag-panel__count">{chunks.length} chunk{chunks.length === 1 ? "" : "s"}</span>
      </div>
      {chunks.length === 0 ? (
        <p className="rag-panel__empty">No relevant chunks retrieved for the last query.</p>
      ) : (
        <ul className="rag-panel__list">
          {chunks.map((chunk) => (
            <li key={chunk.id} className="rag-panel__item">
              <div className="rag-panel__item-meta">
                <span className="rag-panel__source">{chunk.source}</span>
                <span className="rag-panel__score">{chunk.score.toFixed(2)}</span>
              </div>
              <p className="rag-panel__text">{chunk.text}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
