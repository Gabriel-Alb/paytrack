import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { passwordRecoveryApi } from '../src/services/passwordRecovery.js'
import { useAuth, restoreAuth } from '../src/composables/useAuth.js'
import { request, setCsrfToken } from '../src/services/api.js'

const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch; setCsrfToken('') })

test('API de recuperação envia apenas identificador, respeita CSRF e retorna segredo somente na aprovação', async () => {
  const calls = []
  globalThis.fetch = async (url,options) => {
    calls.push({url,...options})
    return {ok:true,status:200,json:async () => url.endsWith('/auth/csrf') ? {csrfToken:'csrf'} : url.endsWith('/approve') ? {temporaryPassword:'OneTimeSecret123',expiresAt:123} : {message:'Solicitação registrada.'}}
  }
  await passwordRecoveryApi.request('person@example.test')
  assert.deepEqual(JSON.parse(calls[1].body),{email:'person@example.test'})
  assert.equal(calls[1].headers['X-CSRF-Token'],'csrf')
  assert.equal(calls[1].credentials,'include')
  const result = await passwordRecoveryApi.approve(10)
  assert.equal(result.temporaryPassword,'OneTimeSecret123')
  await passwordRecoveryApi.list({status:'completed',page:2})
  await passwordRecoveryApi.reject(11)
  assert.ok(calls.some(item => item.url.endsWith('/users/password-reset-requests?status=completed&page=2')))
  assert.ok(!JSON.stringify(calls).includes('OneTimeSecret123'))
})

test('sessão restrita restaura a troca obrigatória e recebe CSRF novo ao concluir', async () => {
  const restricted = {id:1,name:'Pessoa',email:'person@example.test',mustChangePassword:true}
  const normal = {id:1,role:'user',companyIds:[1]}
  const calls = []
  let completed = false
  setCsrfToken('restricted-csrf')
  globalThis.fetch = async (url,options) => {
    calls.push({url,...options})
    if (url.endsWith('/change-required-password')) completed = true
    return {ok:true,status:200,json:async () => ({user:completed ? normal : restricted,csrfToken:completed ? 'normal-csrf' : 'restricted-csrf'})}
  }
  assert.equal((await restoreAuth()).mustChangePassword,true)
  await useAuth().changeRequiredPassword({newPassword:'NovaSenha123'})
  assert.deepEqual(useAuth().user.value,normal)
  await request('/auth/logout',{method:'POST'})
  assert.equal(calls.at(-1).headers['X-CSRF-Token'],'normal-csrf')
  assert.equal(calls[1].headers['X-CSRF-Token'],'restricted-csrf')
})

test('erro na troca não libera a sessão restrita', async () => {
  globalThis.fetch = async () => ({ok:true,status:200,json:async () => ({user:{id:1,mustChangePassword:true}})})
  await restoreAuth()
  setCsrfToken('csrf')
  globalThis.fetch = async () => ({ok:false,status:400,json:async () => ({error:{code:'PASSWORD_UNCHANGED',message:'Escolha outra senha.'}})})
  await assert.rejects(useAuth().changeRequiredPassword({newPassword:'Temporaria123'}),{code:'PASSWORD_UNCHANGED'})
  assert.equal(useAuth().user.value.mustChangePassword,true)
})
