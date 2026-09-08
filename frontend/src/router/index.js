import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),

  routes: [
    {
      path: '/',
      component: () => import('@/layouts/AppLayout.vue'),
      children: [
        {
          path: '',
          name: 'dashboard',
          component: () => import('@/features/dashboard/views/DashboardView.vue'),
        },
        {
          path: 'clients',
          name: 'clients',
          meta: {
            title: 'Gestão de clientes',
          },
          component: () => import('@/features/clients/views/ClientsView.vue'),
        },
        {
          path: 'loans',
          name: 'loans',
          meta: {
            title: 'Empréstimos',
          },
          component: () => import('@/features/loans/views/LoansView.vue'),
        },
                {
          path: 'reports',
          name: 'reports',
          meta: {
            title: 'Relatórios',
          },
          component: () => import('@/features/reports/views/ReportsView.vue'),
        },
      ],
    },
  ],
})

export default router
