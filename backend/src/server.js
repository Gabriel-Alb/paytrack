import { app } from "./app.js";
import { env } from "./config/env.js";
import { openDatabase, closeDatabase } from "./config/database.js";
import { refreshFinancialState } from "./modules/installments/installments.service.js";

openDatabase();
refreshFinancialState();
const server = app.listen(env.PORT, env.HOST, () => {
  process.stdout.write(`PayTrack API: http://${env.HOST}:${env.PORT}\n`);
});

function shutdown() {
  server.close(() => {
    closeDatabase();
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
