import { app } from "./app.js";
import { env } from "./config/env.js";
import { openDatabase, closeDatabase } from "./config/database.js";
import { refreshFinancialState } from "./modules/installments/installments.service.js";
import { cleanup } from './modules/auth/auth.repository.js';
import { prepareAuth } from './modules/auth/auth.service.js';

try {
  await openDatabase();
  await prepareAuth();
  await refreshFinancialState();
  await cleanup();
} catch {
  await closeDatabase();
  console.error('Falha ao inicializar a API. Verifique a configuração e as migrations.');
  process.exit(1);
}
let maintenanceWork = Promise.resolve();
let maintenanceRunning = false;
const maintenance = setInterval(() => {
  if (maintenanceRunning) return;
  maintenanceRunning = true;
  maintenanceWork = cleanup().catch(() => console.error('Falha na manutenção de autenticação.'))
    .finally(() => { maintenanceRunning = false; });
},15*60*1000);
maintenance.unref();
const server = app.listen(env.PORT, env.HOST, () => {
  process.stdout.write(`PayTrack API: http://${env.HOST}:${env.PORT}\n`);
});

let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  clearInterval(maintenance);
  const forceClose = setTimeout(() => server.closeAllConnections(),5000);
  forceClose.unref();
  server.close(async () => {
    clearTimeout(forceClose);
    await maintenanceWork;
    try { await closeDatabase(); }
    catch { console.error('Falha ao encerrar a persistência.'); process.exitCode = 1; }
  });
}
server.on('error', () => {
  console.error('Falha ao abrir a porta da API.');
  process.exitCode = 1;
  shutdown();
});
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
