
import type { ClientMessage, ConnectionStatus, ServerMessage } from "../../types";

export interface VoiceSocketHandlers {
  onMessage: (msg: ServerMessage) => void;
  onStatusChange: (status: ConnectionStatus) => void;
}

const MAX_RECONNECT_ATTEMPTS = 5;

export class VoiceWebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private closedByUser = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly url: string, private readonly handlers: VoiceSocketHandlers) {}

  connect(): void {
    this.closedByUser = false;
    this.open();
  }

  private open(): void {
    this.handlers.onStatusChange(this.reconnectAttempts > 0 ? "reconnecting" : "connecting");
    const ws = new WebSocket(this.url);
    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.handlers.onStatusChange("connected");
    };

    ws.onmessage = (event) => {
      if (typeof event.data === "string") {
        try {
          const parsed = JSON.parse(event.data) as ServerMessage;
          this.handlers.onMessage(parsed);
        } catch {

        }
      }
    };

    ws.onerror = () => {
      this.handlers.onStatusChange("error");
    };

    ws.onclose = () => {
      if (this.closedByUser) {
        this.handlers.onStatusChange("disconnected");
        return;
      }
      this.scheduleReconnect();
    };

    this.ws = ws;
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.handlers.onStatusChange("error");
      return;
    }
    this.reconnectAttempts++;
    const delay = Math.min(8000, 500 * 2 ** this.reconnectAttempts);
    this.handlers.onStatusChange("reconnecting");
    this.reconnectTimer = setTimeout(() => this.open(), delay);
  }

  sendAudio(frame: ArrayBuffer): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(frame);
    }
  }

  sendMessage(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  close(): void {
    this.closedByUser = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
