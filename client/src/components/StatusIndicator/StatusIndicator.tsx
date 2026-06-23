/**
 * Small telemetry chips: WebSocket connection status and the detected
 * language of the current/last user utterance. Lives in the header so
 * it's always visible without competing with the central state orb.
 */
import type { ConnectionStatus, SupportedLanguage } from "../../types";
import "./StatusIndicator.css";

interface Props {
  connectionStatus: ConnectionStatus;
  language: SupportedLanguage | null;
}

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  disconnected: "Offline",
  connecting: "Connecting…",
  connected: "Connected",
  reconnecting: "Reconnecting…",
  error: "Connection error",
};

const LANGUAGE_LABEL: Record<SupportedLanguage, string> = {
  en: "English",
  hi: "हिन्दी",
  hinglish: "Hinglish",
};

export function StatusIndicator({ connectionStatus, language }: Props) {
  return (
    <div className="status-indicator">
      <span className={`status-indicator__dot status-indicator__dot--${connectionStatus}`} aria-hidden="true" />
      <span className="status-indicator__label">{STATUS_LABEL[connectionStatus]}</span>
      {language && (
        <span className="status-indicator__lang" title="Detected language">
          {LANGUAGE_LABEL[language]}
        </span>
      )}
    </div>
  );
}
