import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ref } from 'vue'
import { useNotifications } from '../src/composables/useNotifications.js'

test('somente empréstimos, pagamentos e atrasos aparecem, sem misturar eventos', () => {
  const events = ['loan_created', 'loan_updated', 'installments_updated', 'loan_cancelled', 'payment_created', 'payment_corrected', 'payment_voided']
  const notifications = ref([
    ...events.map((event, id) => ({ id, event, type: event.startsWith('payment') ? 'payment' : 'loan', datetime: '2026-09-14T12:00:00Z' })),
    ...['overdue', 'registration', 'access', 'unknown'].map(type => ({ id: type, type, datetime: '2026-09-13T12:00:00Z' })),
  ])
  const { activeFilter, filters, groupedNotifications } = useNotifications(notifications)
  const visible = () => groupedNotifications.value.flatMap(group => group.notifications)
  assert.deepEqual(filters.map(item => item.label), ['Empréstimos', 'Pagamentos', 'Atrasos'])
  assert.equal(activeFilter.value, 'loan')
  for (const [type, count] of [['loan', 4], ['payment', 3], ['overdue', 1]]) {
    activeFilter.value = type
    assert.equal(visible().length, count)
    assert.ok(visible().every(item => item.type === type))
  }
  notifications.value = []
  assert.deepEqual(groupedNotifications.value, [])
  notifications.value = [{ id: 99, type: 'overdue', datetime: '2026-09-14T12:00:00Z' }]
  assert.equal(visible()[0].id, 99)
})
