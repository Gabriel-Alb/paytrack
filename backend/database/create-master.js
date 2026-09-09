import { createInterface } from 'node:readline/promises';
import { emitKeypressEvents } from 'node:readline';
import { openDatabase,closeDatabase } from '../src/config/database.js';
import { createMaster } from '../src/modules/auth/auth.service.js';
import { hasMaster } from '../src/modules/auth/auth.repository.js';

function hiddenPassword(label) {
  process.stdout.write(label);
  emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolve,reject) => {
    let value='';
    function finish(error) {
      process.stdin.off('keypress',keypress);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
      if (error) reject(error); else resolve(value);
      value='';
    }
    function keypress(text,key={}) {
      if (key.ctrl && key.name==='c') return finish(new Error('Cancelado.'));
      if (key.name==='return') return finish();
      if (key.name==='backspace') value=[...value].slice(0,-1).join('');
      else if (text && !key.ctrl && !key.meta && !text.includes(String.fromCharCode(27)) && !/[\r\n]/.test(text) && value.length<1024) value+=text;
    }
    process.stdin.on('keypress',keypress);
  });
}

let form;
try {
  if (process.argv.length!==2 || !process.stdin.isTTY || !process.stdout.isTTY)
    throw new Error('Use npm run auth:create-master em um terminal interativo, sem argumentos.');
  openDatabase();
  if (hasMaster()) throw new Error('Já existe um master. Nenhum usuário foi criado.');
  const input=createInterface({input:process.stdin,output:process.stdout});
  try {
    form={};
    for (const [field,label] of Object.entries({name:'Nome',email:'E-mail',cpf:'CPF',rg:'RG (opcional)',cnh:'CNH (opcional)'}))
      form[field]=await input.question(`${label}: `);
  } finally { input.close(); }
  form.password=await hiddenPassword('Senha (15–128 caracteres, sem eco): ');
  let confirmation=await hiddenPassword('Confirme a senha: ');
  if (form.password!==confirmation) throw new Error('As senhas não coincidem.');
  confirmation='';
  await createMaster(form);
  process.stdout.write('Master criado com acesso ativo.\n');
} catch (error) {
  const message=error.code==='MASTER_EXISTS' ? 'Já existe um master.' :
    error.name==='ZodError' ? 'Dados inválidos. Verifique e-mail, documentos e senha de 15–128 caracteres.' :
    error.code?.startsWith('SQLITE') ? 'Não foi possível criar: verifique duplicidade de dados e o banco.' :
    ['Cancelado.','As senhas não coincidem.','Já existe um master. Nenhum usuário foi criado.','Use npm run auth:create-master em um terminal interativo, sem argumentos.'].includes(error.message) ? error.message : 'Não foi possível criar o master. Verifique a configuração.';
  process.stderr.write(`${message}\n`);
  process.exitCode=1;
} finally {
  if (form) form.password='';
  closeDatabase();
}
