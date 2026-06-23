/** Generates a reasonably-unique id for client-side conversation turns (display keys only, not security-sensitive). */
export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}
