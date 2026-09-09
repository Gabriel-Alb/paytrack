import { app } from "./app.js";
import { env } from "./config/env.js";
import { openDatabase, closeDatabase } from "./config/database.js";
import { refreshFinancialState } from "./modules/installments/installments.service.js";
import { cleanup } from './modules/auth/auth.repository.js';
import { prepareAuth } from './modules/auth/auth.service.js';

openDatabase();
await prepareAuth();
refreshFinancialState();
cleanup();
const maintenance = setInterval(cleanup,15*60*1000);
maintenance.unref();
const server = app.listen(env.PORT, env.HOST, () => {
  process.stdout.write(`PayTrack API: http://${env.HOST}:${env.PORT}\n`);
});

function shutdown() {
  clearInterval(maintenance);
  server.close(() => {
    closeDatabase();
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
