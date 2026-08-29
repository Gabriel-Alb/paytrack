const clients = [
  {
    id: 1,
    name: 'João da Silva',
    cpf: '123.456.789-00',
    rg: '12.345.678-9',
    phone: '(11) 99999-1234',
    email: 'joao.silva@email.com',
    cnh: '01234567890',
    status: 'ativo',
    loans: [
      {
        id: 24,
        amount: 5000,
        installments: 12,
        status: 'quitado',
        startDate: '2025-05-10',
        endDate: '2026-04-10',
      },
      {
        id: 41,
        amount: 2500,
        installments: 5,
        status: 'ativo',
        startDate: '2026-08-10',
        endDate: null,
      },
    ],
  },
  {
    id: 2,
    name: 'Maria Oliveira Santos',
    cpf: '987.654.321-00',
    rg: '45.678.912-3',
    phone: '(11) 98888-4567',
    email: 'maria.oliveira@email.com',
    cnh: '09876543210',
    status: 'quitado',
    loans: [
      {
        id: 18,
        amount: 3000,
        installments: 6,
        status: 'quitado',
        startDate: '2025-08-15',
        endDate: '2026-01-15',
      },
    ],
  },
  {
    id: 3,
    name: 'Carlos Henrique Souza',
    cpf: '456.789.123-00',
    rg: '33.456.789-1',
    phone: '(11) 97777-8901',
    email: 'carlos.souza@email.com',
    cnh: '04567891234',
    status: 'negativado',
    loans: [
      {
        id: 37,
        amount: 7500,
        installments: 15,
        status: 'negativado',
        startDate: '2026-02-20',
        endDate: null,
      },
    ],
  },
  {
    id: 4,
    name: 'Fernanda Lima Costa',
    cpf: '741.852.963-00',
    rg: '56.789.123-4',
    phone: '(11) 96666-2345',
    email: 'fernanda.lima@email.com',
    cnh: '07418529630',
    status: 'ativo',
    loans: [
      {
        id: 44,
        amount: 4200,
        installments: 10,
        status: 'ativo',
        startDate: '2026-07-05',
        endDate: null,
      },
    ],
  },
  {
    id: 5,
    name: 'Rafael Mendes Rocha',
    cpf: '159.357.486-00',
    rg: '27.369.258-1',
    phone: '(11) 95555-6789',
    email: 'rafael.mendes@email.com',
    cnh: '01593574860',
    status: 'quitado',
    loans: [],
  },
]

let nextClientId = clients.length + 1

function cloneClient(client) {
  return structuredClone(client)
}

const clientsService = {
  async getClients() {
    return clients.map(cloneClient)
  },

  async createClient(payload) {
    const client = {
      id: nextClientId++,
      ...payload,
      status: 'ativo',
      loans: [],
    }

    clients.unshift(client)

    return cloneClient(client)
  },

  async updateClient(id, payload) {
    const index = clients.findIndex((client) => client.id === id)

    if (index === -1) {
      throw new Error('Cliente não encontrado.')
    }

    clients[index] = {
      ...clients[index],
      ...payload,
      id,
    }

    return cloneClient(clients[index])
  },

  async updateClientStatus(id, status) {
    const client = clients.find((item) => item.id === id)

    if (!client) {
      throw new Error('Cliente não encontrado.')
    }

    client.status = status

    return cloneClient(client)
  },
}

export default clientsService
