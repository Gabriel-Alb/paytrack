import { networkInterfaces } from 'node:os';
import { env } from './env.js';

const allowedOrigins = new Set([env.FRONTEND_ORIGIN]);
if (env.NODE_ENV === 'development') {
  const configured = new URL(env.FRONTEND_ORIGIN);
  const hosts = ['localhost', '127.0.0.1', '[::1]'];
  for (const addresses of Object.values(networkInterfaces())) {
    for (const { address, family } of addresses || []) {
      // Only this machine's LAN addresses; never arbitrary hosts from the request.
      if (family === 'IPv4' && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address))
        hosts.push(address);
    }
  }
  for (const host of hosts) {
    const origin = new URL(configured);
    origin.hostname = host;
    allowedOrigins.add(origin.origin);
  }
}

export const isAllowedOrigin = (origin) => allowedOrigins.has(origin);
