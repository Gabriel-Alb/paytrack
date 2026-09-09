import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validPassword, PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from '../../shared/password.js'

test('regra compartilhada aceita apenas 6–20 caracteres, sem trim ou truncamento', () => {
  assert.equal(PASSWORD_MIN_LENGTH, 6)
  assert.equal(PASSWORD_MAX_LENGTH, 20)
  for (const length of [0, 5, 6, 20, 21])
    assert.equal(validPassword('a'.repeat(length)), length >= 6 && length <= 20)
  assert.equal(validPassword(' frase com espaços '), true)
  assert.equal(validPassword('😀'.repeat(10)), true)
  assert.equal(validPassword('😀'.repeat(11)), false)
  for (const value of [undefined, null, 123456]) assert.equal(validPassword(value), false)
})
