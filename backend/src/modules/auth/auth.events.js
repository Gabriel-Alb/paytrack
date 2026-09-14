import { EventEmitter } from 'node:events';

export const accessEvents = new EventEmitter();
accessEvents.setMaxListeners(0);

// A disconnected subscriber must not turn a committed write into an HTTP error
// or prevent the other administrators from receiving the change.
export function notifyAccessChanged() {
  for (const listener of accessEvents.rawListeners('changed')) {
    try { listener.call(accessEvents); }
    catch { console.error('Falha ao atualizar assinante de acesso.'); }
  }
}
