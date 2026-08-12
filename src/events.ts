import type { AgentEvent, EventHandler } from "./types.js";

export class EventEmitter {
  private handlers: EventHandler[] = [];

  on(handler: EventHandler): void {
    this.handlers.push(handler);
  }

  emit(event: AgentEvent): void {
    for (const handler of this.handlers) {
      handler(event);
    }
  }
}
