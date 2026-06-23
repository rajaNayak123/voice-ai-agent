
import type { AgentState } from "../../types";
import "./ControlPanel.css";

interface Props {
  agentState: AgentState;
  sessionActive: boolean;
  onToggleSession: () => void;
}

const STATE_LABEL: Record<AgentState, string> = {
  idle: "Tap to talk",
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Speaking…",
};

export function ControlPanel({ agentState, sessionActive, onToggleSession }: Props) {
  const label = sessionActive ? STATE_LABEL[agentState] : "Tap to talk";

  return (
    <div className="control-panel">
      <button
        type="button"
        className={`control-panel__orb control-panel__orb--${sessionActive ? agentState : "idle"}`}
        onClick={onToggleSession}
        aria-pressed={sessionActive}
        aria-label={sessionActive ? "End conversation" : "Start conversation"}
      >
        <span className="control-panel__ring control-panel__ring--outer" aria-hidden="true" />
        <span className="control-panel__ring control-panel__ring--inner" aria-hidden="true" />
        <span className="control-panel__icon" aria-hidden="true">
          {sessionActive ? <StopIcon /> : <MicIcon />}
        </span>
      </button>
      <p className="control-panel__label">{label}</p>
      <p className="control-panel__hint">
        {sessionActive ? "Speak naturally — interrupt anytime by talking" : "English · Hindi · Hinglish"}
      </p>
    </div>
  );
}

function MicIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 15a3 3 0 003-3V6a3 3 0 10-6 0v6a3 3 0 003 3z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 11a7 7 0 01-14 0M12 18v3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
    </svg>
  );
}
