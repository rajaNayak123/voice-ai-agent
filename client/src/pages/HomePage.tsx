
import { useVoiceAgent } from "../hooks/useVoiceAgent";
import { useConversationHistory } from "../hooks/useConversationHistory";
import { useLatencyMetrics } from "../hooks/useLatencyMetrics";
import { useConversationStore } from "../store/conversationStore";
import { StatusIndicator } from "../components/StatusIndicator/StatusIndicator";
import { ControlPanel } from "../components/ControlPanel/ControlPanel";
import { ConversationView } from "../components/ConversationView/ConversationView";
import { LatencyPanel } from "../components/LatencyPanel/LatencyPanel";
import { RagPanel } from "../components/RagPanel/RagPanel";
import { useState } from "react";
import "./HomePage.css";

export function HomePage() {
  const { startSession, endSession, connectionStatus, agentState } = useVoiceAgent();
  const { history, partialTranscript, streamingResponse } = useConversationHistory();
  const metrics = useLatencyMetrics();
  const currentLanguage = useConversationStore((s) => s.currentLanguage);
  const retrievedChunks = useConversationStore((s) => s.retrievedChunks);
  const lastError = useConversationStore((s) => s.lastError);
  const setError = useConversationStore((s) => s.setError);

  const [sessionActive, setSessionActive] = useState(false);

  const handleToggleSession = async () => {
    if (sessionActive) {
      endSession();
      setSessionActive(false);
    } else {
      setSessionActive(true);
      await startSession();
    }
  };

  return (
    <div className="home-page">
      <header className="home-page__header">
        <div className="home-page__brand">
          <span className="home-page__brand-mark" aria-hidden="true" />
          <span className="home-page__brand-name">NovaVoice</span>
        </div>
        <StatusIndicator connectionStatus={connectionStatus} language={currentLanguage} />
      </header>

      {lastError && (
        <div className="home-page__error" role="alert">
          <span>{lastError}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss error">
            ×
          </button>
        </div>
      )}

      <main className="home-page__main">
        <section className="home-page__console">
          <ControlPanel
            agentState={agentState}
            sessionActive={sessionActive}
            onToggleSession={handleToggleSession}
          />
        </section>

        <section className="home-page__feed">
          <ConversationView
            history={history}
            partialTranscript={partialTranscript}
            streamingResponse={streamingResponse}
          />
        </section>
      </main>

      <footer className="home-page__footer">
        <LatencyPanel metrics={metrics} />
        <RagPanel chunks={retrievedChunks} />
      </footer>
    </div>
  );
}
