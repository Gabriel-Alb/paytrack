import { test } from 'node:test'
import assert from 'node:assert/strict'
import { restoreAuth,onSessionExpired,useAuth } from '../src/composables/useAuth.js'
import { request } from '../src/services/api.js'

test('restaurar sessão ausente não dispara redirect recursivo; 401 privado dispara expiração',async()=>{
  const previous=globalThis.fetch
  let calls=0,redirects=0
  onSessionExpired(()=>redirects++)
  globalThis.fetch=async()=>{calls++;return {ok:false,status:401,json:async()=>({error:{code:'UNAUTHENTICATED',message:'Entre novamente.'}})}}
  try {
    const results=await Promise.all([restoreAuth(),restoreAuth()])
    assert.deepEqual(results,[null,null]);assert.equal(calls,1);assert.equal(redirects,0)
    await assert.rejects(request('/clients'),{code:'UNAUTHENTICATED'})
    assert.equal(redirects,1);assert.equal(useAuth().user.value,null)
  } finally {globalThis.fetch=previous;onSessionExpired(()=>{})}
})
