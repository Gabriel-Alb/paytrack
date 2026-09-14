import { test,afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync,readdirSync } from 'node:fs'
import { request,setCsrfToken,setUnauthorizedHandler } from '../src/services/api.js'

const originalFetch=globalThis.fetch
afterEach(()=>{globalThis.fetch=originalFetch;setCsrfToken('');setUnauthorizedHandler(()=>{})})
const response=(status,body)=>({ok:status===200,status,json:async()=>body})

test('rede indisponível e resposta não JSON geram mensagens compreensíveis; cancelamentos são preservados', async () => {
  setCsrfToken('test')
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch') }
  await assert.rejects(request('/auth/request-access', {method:'POST',body:{}}), /Verifique sua conexão/)
  globalThis.fetch = async () => ({ok:true,status:202,json:async () => { throw new SyntaxError('HTML') }})
  await assert.rejects(request('/auth/request-access', {method:'POST',body:{}}), /resposta inesperada/)
  globalThis.fetch = async () => { throw Object.assign(new Error('Cancelado'), {name:'AbortError'}) }
  await assert.rejects(request('/clients'), {name:'AbortError'})
})
test('HTTP usa cookies e header CSRF em todos os verbos de escrita, nunca na URL',async()=>{
  const calls=[]
  globalThis.fetch=async (url,options)=>{calls.push({url,options});return response(200,url.endsWith('/csrf')?{csrfToken:'test-csrf-memory'}:{ok:true})}
  for(const method of ['POST','PUT','PATCH','DELETE'])await request('/clients',{method,body:{name:'Teste'}})
  assert.equal(calls.filter(({url})=>url.endsWith('/csrf')).length,1)
  for(const {url,options} of calls){assert.equal(options.credentials,'include');assert.ok(!url.includes('test-csrf-memory'));if(options.method!=='GET')assert.equal(options.headers['X-CSRF-Token'],'test-csrf-memory')}
})
test('CSRF rejeitado é atualizado e operação repetida uma única vez',async()=>{
  setCsrfToken('expired')
  const calls=[]
  globalThis.fetch=async (url,options)=>{
    calls.push({url,options})
    return url.endsWith('/csrf')?response(200,{csrfToken:'fresh'}):options.headers['X-CSRF-Token']==='expired'?response(403,{error:{code:'CSRF_INVALID'}}):response(200,{ok:true})
  }
  await request('/auth/logout',{method:'POST'})
  assert.equal(calls.length,3);assert.equal(calls[2].options.headers['X-CSRF-Token'],'fresh')
})
test('401 de sessão expirada é centralizado; erro de credenciais não simula logout',async()=>{
  let expired=0
  setUnauthorizedHandler(()=>expired++)
  globalThis.fetch=async()=>response(401,{error:{code:'UNAUTHENTICATED',message:'Entre novamente.'}})
  await assert.rejects(request('/auth/me'),{code:'UNAUTHENTICATED'})
  assert.equal(expired,1)
  setCsrfToken('test')
  globalThis.fetch=async()=>response(401,{error:{code:'INVALID_CREDENTIALS',message:'E-mail ou senha inválidos.'}})
  await assert.rejects(request('/auth/login',{method:'POST',body:{}}),{code:'INVALID_CREDENTIALS'})
  assert.equal(expired,1)
})
test('frontend não persiste senha/sessão e não contorna escaping Vue',()=>{
  const root=new URL('../src/',import.meta.url)
  for(const name of readdirSync(root,{recursive:true}).filter((name)=>/\.(vue|js)$/.test(name))) {
    const source=readFileSync(new URL(name.replaceAll('\\','/'),root),'utf8')
    assert.ok(!/localStorage|sessionStorage|indexedDB|document\.cookie|v-html/.test(source),name)
  }
})
