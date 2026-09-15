import { unitOfWork } from '../src/application/persistence.js';
import { env } from '../src/config/env.js';
import { pathToFileURL } from 'node:url';
import { openDatabase, closeDatabase, database } from '../src/config/database.js';
import { createClient } from '../src/modules/clients/clients.service.js';
import { clientSchema } from '../src/modules/clients/clients.validator.js';
import { createLoan } from '../src/modules/loans/loans.service.js';
import { loanSchema } from '../src/modules/loans/loans.validator.js';
import { registerPayment } from '../src/modules/payments/payments.service.js';
import { today, addDays } from '../src/shared/utils/dates.js';

export async function seedDevelopment() {
  if (env.NODE_ENV === 'production') throw new Error('Seed disponível apenas para desenvolvimento.');
  return (await unitOfWork(async () => {
      const date = today();
      const examples = [
        { name: 'Mariana Costa', cpf: '52998224725', due: 1, count: 3 },
        { name: 'Rafael Alves', cpf: '11144477735', due: -1, count: 2, partial: 5000 },
        { name: 'Juliana Santos', cpf: '12345678909', due: -5, count: 2 },
        { name: 'Carlos Souza', cpf: '98765432100', due: -3, count: 1, paid: true },
        { name: 'Ana Oliveira', cpf: '11122233396', due: 0, count: 1, paid: true },
        { name: 'Lucas Lima', cpf: '01234567890', noLoan: true },
      ];
      let created = 0;
      for (const [index, example] of examples.entries()) {
        if ((await database().prepare('SELECT id FROM clients WHERE cpf=?').get(example.cpf))) continue;
        const client = (await createClient(
          clientSchema.parse({
            name: example.name,
            cpf: example.cpf,
            rg: `SEED${index + 1}`,
            cnh: `9000000000${index}`,
            notes: 'Demonstração de desenvolvimento',
          }),
        ));
        created++;
        if (example.noLoan) continue;
        const loan = (await createLoan(
          loanSchema.parse({
            company_id: 1,
            client_id: client.id,
            principal_amount: 30000,
            interest_percentage: '10',
            installment_count: example.count,
            late_fee_per_day: 200,
            loan_date: addDays(date, -10),
            first_due_date: addDays(date, example.due),
            ...(example.count === 3 ? { installment_overrides: { 0: 10000 } } : {}),
            notes: 'Demonstração de desenvolvimento',
          }),
        ));
        if (example.paid || example.partial)
          (await registerPayment(loan.installments[0].id, {
            amount: example.partial || loan.installments[0].amount,
            payment_date: date,
            revision: loan.revision,
          }));
      }
      return created;
    }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Seed disponível apenas para desenvolvimento.');
  (await openDatabase());
  try {
    process.stdout.write(`Seed concluído: ${(await seedDevelopment())} clientes criados.\n`);
  } finally {
    (await closeDatabase());
  }
}
