import { EventEmitter } from 'node:events';

export const accessEvents = new EventEmitter();
accessEvents.setMaxListeners(0);
