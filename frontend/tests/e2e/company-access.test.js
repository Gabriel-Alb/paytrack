import { test } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const require=createRequire(import.meta.url);
const { chromium }=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const root=process.env.E2E_ARTIFACT_DIR || fs.mkdtempSync(join(tmpdir(),'paytrack-browser-'));
const url='http://127.0.0.1:5179';
test('cadastro, escopo, decisões, accordion, níveis e revogação no navegador', {timeout:180000}, async t=>{
 await import('../../../backend/tests/setup-env.js');
 process.env.FRONTEND_ORIGIN=url;
 const { app }=await import('../../../backend/src/app.js');
 const { openDatabase,closeDatabase }=await import('../../../backend/src/config/database.js');
 let api, vite, browser;
 t.after(async()=>{
  await browser?.close();
  await vite?.close();
  if(api){api.closeAllConnections();await new Promise(resolve=>api.close(resolve));}
  await closeDatabase();
 });
 const { insertUser }=await import('../../../backend/src/modules/auth/auth.repository.js');
 const { hashPassword }=await import('../../../backend/src/modules/auth/auth.service.js');
 const { setMembership }=await import('../../../backend/src/modules/companies/companies.repository.js');
 await openDatabase(':memory:');
 const passwordHash=await hashPassword('QaSenha123');
 for(const [name,email,role,links] of [['Admin QA','admin@qa.test','admin',[]],['Gerente QA','manager@qa.test','user',[[1,'MANAGER'],[2,'USER']]],['Membro QA','member@qa.test','user',[[1,'USER']]],['Gerente Outra','other@qa.test','user',[[2,'MANAGER']]]]) {
  const id=await insertUser({name,email,cpf:null,passwordHash},role,'active');
  for(const [companyId,companyRole] of links) await setMembership(id,companyId,companyRole);
 }
 api=app.listen(33021,'127.0.0.1');
 await new Promise(resolve=>api.once('listening',resolve));
 const { createServer }=await import('vite');
 vite=await createServer({mode:'test',root:fileURLToPath(new URL('../..',import.meta.url)),server:{host:'127.0.0.1',port:5179,strictPort:true,proxy:{'/api':'http://127.0.0.1:33021'}}});
 await vite.listen();
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? {executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE} : {})});
 const failures=[], errors=[], warnings=[], checks=[];
 async function pageFor(email) {
  const context=await browser.newContext({viewport:{width:1440,height:1000}}), page=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='warning') warnings.push(message.text()); if(message.type()==='error'&&!/status of (401|403|409)/.test(message.text())) errors.push(message.location().url+': '+message.text())});
  await page.goto(url+'/login');
  if(email){await page.getByLabel('E-mail',{exact:true}).fill(email);await page.locator('#password').fill('QaSenha123');await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.waitForURL(url+'/');}
  return page;
 }
 async function check(name,run){await run();checks.push(name);t.diagnostic('PASS '+name)}
 try {
  const visitor=await pageFor();
  await check('cadastro multiempresa desktop e mobile',async()=>{
   await visitor.getByRole('link',{name:'Solicite acesso'}).click();
   await visitor.getByLabel('Dinheiro Express',{exact:true}).check();
   await visitor.getByLabel('Platinum Finance',{exact:true}).check();
   assert.equal(await visitor.locator('input[type=checkbox]:checked').count(),2);
   await visitor.screenshot({path:root+'/request-desktop.png',fullPage:true,animations:'disabled'});
   await visitor.setViewportSize({width:390,height:844});
   assert.ok(await visitor.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
   await visitor.screenshot({path:root+'/request-mobile.png',fullPage:true,animations:'disabled'});
   await visitor.getByLabel('Nome completo').fill('Solicitante QA');
   await visitor.getByLabel('E-mail',{exact:true}).fill('applicant@qa.test');
   await visitor.getByLabel('CPF',{exact:true}).fill('52998224725');
   await visitor.locator('#new-password').fill('QaSenha123');
   await visitor.locator('#confirm-password').fill('QaSenha123');
   const response=visitor.waitForResponse(r=>r.url().endsWith('/auth/request-access')&&r.request().method()==='POST');
   await visitor.getByRole('button',{name:'Enviar solicitação'}).click();assert.equal((await response).status(),202);
   await visitor.waitForURL(url+'/login');
  });
  const manager=await pageFor('manager@qa.test');
  await check('gerente vê apenas solicitação e empresa administradas',async()=>{
   await manager.goto(url+'/users');await manager.getByText('Solicitante QA',{exact:true}).waitFor();
   assert.equal(await manager.getByRole('button',{name:'Nova empresa',exact:true}).count(),0);
   assert.equal(await manager.getByRole('button',{name:/Platinum Finance/}).count(),0);
   await manager.getByRole('button',{name:'Ver acesso',exact:true}).click();
   const modal=manager.getByRole('dialog');await modal.getByText('Dinheiro Express',{exact:true}).waitFor();
   assert.equal(await modal.getByText('Platinum Finance',{exact:true}).count(),0);
   assert.equal(await modal.getByText('CPF',{exact:true}).count(),0);
   await modal.getByLabel('Decisão',{exact:true}).selectOption('approve');
   await modal.getByLabel('Nível na empresa',{exact:true}).selectOption('MANAGER');
   await manager.screenshot({path:root+'/manager-decision.png',fullPage:true,animations:'disabled'});
   await modal.getByRole('button',{name:'Salvar decisões',exact:true}).click();
   await modal.waitFor({state:'hidden'});
   await manager.getByText('Nenhum usuário encontrado',{exact:true}).waitFor();
  });
  const admin=await pageFor('admin@qa.test');
  await check('admin decide empresa remanescente sem alterar aprovação anterior',async()=>{
   await admin.goto(url+'/users');await admin.getByText('Solicitante QA',{exact:true}).waitFor();
   await admin.getByRole('button',{name:'Ver acesso',exact:true}).click();
   const modal=admin.getByRole('dialog');await modal.getByLabel('Decisão',{exact:true}).waitFor();
   assert.equal(await modal.getByLabel('Decisão',{exact:true}).count(),1);
   await modal.getByRole('button',{name:'Recusar demais pendentes'}).click();
   assert.equal(await modal.getByLabel('Decisão',{exact:true}).inputValue(),'reject');
   await modal.getByRole('button',{name:'Salvar decisões',exact:true}).click();await modal.waitFor({state:'hidden'});
   await admin.getByText('Nenhum usuário encontrado',{exact:true}).waitFor();
  });
  await check('accordion e edição de USER/MANAGER persistem após reabrir',async()=>{
   await manager.getByRole('button',{name:/Dinheiro Express/}).click();
   const row=manager.locator('#company-members-1 li').filter({hasText:'Membro QA'});
   await row.getByRole('button',{name:'Editar nível'}).click();
   let modal=manager.getByRole('dialog');await modal.getByLabel('Nível de acesso',{exact:true}).selectOption('MANAGER');
   await modal.getByRole('button',{name:'Salvar',exact:true}).click();await modal.waitFor({state:'hidden'});
   await row.getByText('Gerente · Ativo',{exact:true}).waitFor();
   await manager.reload();await manager.getByRole('button',{name:/Dinheiro Express/}).click();
   await row.getByText('Gerente · Ativo',{exact:true}).waitFor();
   await row.getByRole('button',{name:'Editar nível'}).click();modal=manager.getByRole('dialog');
   assert.equal(await modal.getByLabel('Nível de acesso',{exact:true}).inputValue(),'MANAGER');
   await modal.getByLabel('Nível de acesso',{exact:true}).selectOption('USER');
   await modal.getByRole('button',{name:'Salvar',exact:true}).click();await modal.waitFor({state:'hidden'});
   await row.getByText('Usuário · Ativo',{exact:true}).waitFor();
   await manager.screenshot({path:root+'/manager-desktop.png',fullPage:true,animations:'disabled'});
   await manager.setViewportSize({width:390,height:844});
   assert.ok(await manager.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
   await manager.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
   await row.getByRole('button',{name:'Editar nível'}).click();
   modal=manager.getByRole('dialog');
   assert.equal(await modal.getByLabel('Nível de acesso',{exact:true}).inputValue(),'USER');
   await modal.getByRole('button',{name:'Cancelar',exact:true}).click();
   await modal.waitFor({state:'hidden'});
   await manager.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
   await manager.screenshot({path:root+'/manager-mobile.png',animations:'disabled'});
  });
  await check('usuário aprovado acessa apenas empresa aprovada e USER não entra na administração',async()=>{
   const approved=await pageFor('applicant@qa.test');await approved.goto(url+'/users');
   await approved.getByRole('button',{name:/Dinheiro Express/}).waitFor();
   assert.equal(await approved.getByRole('button',{name:/Platinum Finance/}).count(),0);
   const user=await pageFor('member@qa.test');await user.goto(url+'/users');await user.waitForURL(url+'/');
  });
  await check('revogação de gerente pela interface atualiza navegação e protege último gerente',async()=>{
   await manager.setViewportSize({width:1440,height:1000});
   const row=manager.locator('#company-members-1 li').filter({hasText:'Solicitante QA'});
   await row.getByRole('button',{name:'Editar nível'}).click();
   let modal=manager.getByRole('dialog');await modal.getByLabel('Nível de acesso',{exact:true}).selectOption('USER');
   await modal.getByRole('button',{name:'Salvar',exact:true}).click();await modal.waitFor({state:'hidden'});
   await row.getByText('Usuário · Ativo',{exact:true}).waitFor();
   await manager.locator('#company-members-1 li').filter({hasText:'Gerente QA'}).getByRole('button',{name:'Editar nível'}).click();
   modal=manager.getByRole('dialog');await modal.getByLabel('Nível de acesso',{exact:true}).selectOption('USER');
   const response=manager.waitForResponse(r=>r.url().includes('/companies/1/users/')&&r.request().method()==='PATCH');
   await modal.getByRole('button',{name:'Salvar',exact:true}).click();assert.equal((await response).status(),409);
   await manager.getByText('Mantenha outro gerente ativo antes de remover seu próprio acesso de gerente.',{exact:true}).waitFor();
   await modal.getByRole('button',{name:'Cancelar',exact:true}).click();
   await manager.locator('#company-members-1 li').filter({hasText:'Membro QA'}).getByRole('button',{name:'Editar nível'}).click();
   modal=manager.getByRole('dialog');await modal.getByLabel('Nível de acesso',{exact:true}).selectOption('MANAGER');
   await modal.getByRole('button',{name:'Salvar',exact:true}).click();await modal.waitFor({state:'hidden'});
   await manager.locator('#company-members-1 li').filter({hasText:'Gerente QA'}).getByRole('button',{name:'Editar nível'}).click();
   modal=manager.getByRole('dialog');await modal.getByLabel('Nível de acesso',{exact:true}).selectOption('USER');
   await modal.getByRole('button',{name:'Salvar',exact:true}).click();await manager.waitForURL(url+'/');
  });
  await check('identidade, conteúdo, ausência de overlay e saúde do console',async()=>{
   assert.match(await manager.title(),/PayTrack/i);assert.ok((await manager.locator('body').innerText()).length>100);
   assert.equal(await manager.locator('vite-error-overlay').count(),0);
   assert.deepEqual(errors,[]);assert.deepEqual(warnings,[]);
  });
 } catch(error){ failures.push(error.stack);throw error; }
 finally {fs.writeFileSync(root+'/qa-results.json',JSON.stringify({url,checks,failures,errors,warnings},null,2));}
});
