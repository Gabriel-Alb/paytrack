import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import clientsService from '../services/clients.service'

export const useClientsStore = defineStore('clients', () => {
  const clients = ref([])
  const search = ref('')
  const statusFilter = ref('todos')
  const isLoading = ref(false)

  const filteredClients = computed(() => {
    const term = search.value.trim().toLowerCase()

    return clients.value.filter((client) => {
      const matchesStatus = statusFilter.value === 'todos' || client.status === statusFilter.value

      if (!matchesStatus) {
        return false
      }

      if (!term) {
        return true
      }

      return [client.name, client.cpf, client.rg, client.phone, client.email, client.cnh].some(
        (value) =>
          String(value ?? '')
            .toLowerCase()
            .includes(term),
      )
    })
  })

  const totalClients = computed(() => clients.value.length)

  const activeClients = computed(
    () => clients.value.filter((client) => client.status === 'ativo').length,
  )

  const paidClients = computed(
    () => clients.value.filter((client) => client.status === 'quitado').length,
  )

  const negativeClients = computed(
    () => clients.value.filter((client) => client.status === 'negativado').length,
  )

  async function fetchClients() {
    try {
      isLoading.value = true
      clients.value = await clientsService.getClients()
    } finally {
      isLoading.value = false
    }
  }

  async function createClient(payload) {
    const client = await clientsService.createClient(payload)
    clients.value.unshift(client)

    return client
  }

  async function updateClient(id, payload) {
    const updatedClient = await clientsService.updateClient(id, payload)

    const index = clients.value.findIndex((client) => client.id === id)

    if (index !== -1) {
      clients.value[index] = updatedClient
    }

    return updatedClient
  }

  async function updateClientStatus(id, status) {
    const updatedClient = await clientsService.updateClientStatus(id, status)

    const index = clients.value.findIndex((client) => client.id === id)

    if (index !== -1) {
      clients.value[index] = updatedClient
    }

    return updatedClient
  }

  return {
    clients,
    search,
    statusFilter,
    isLoading,
    filteredClients,
    totalClients,
    activeClients,
    paidClients,
    negativeClients,
    fetchClients,
    createClient,
    updateClient,
    updateClientStatus,
  }
})
