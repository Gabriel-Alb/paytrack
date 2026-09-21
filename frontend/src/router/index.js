import { createRouter, createWebHistory } from 'vue-router'
import { canAdminister } from '@/features/auth/companyAccess.js'
import { restoreAuth,onSessionExpired } from '@/composables/useAuth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),

  routes: [
    { path:'/login',name:'login',meta:{public:true},component:()=>import('@/features/auth/views/LoginView.vue') },
    { path:'/request-access',name:'request-access',meta:{public:true},component:()=>import('@/features/auth/views/RequestAccessView.vue') },
    {
      path: '/',
      component: () => import('@/layouts/AppLayout.vue'),
      children: [
        {path:'account',name:'account',meta:{title:'Minha conta'},component:()=>import('@/features/auth/views/AccountView.vue')},
        {path:'users',name:'users',meta:{title:'Administração',admin:true},component:()=>import('@/features/auth/views/UsersView.vue')},
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
          path: 'loans/paid',
          name: 'paid-loans',
          meta: { title: 'Empréstimos quitados' },
          props: { fixedStatus: 'paid' },
          component: () => import('@/features/loans/views/LoansView.vue'),
        },
        {
          path: 'loans/overdue',
          name: 'overdue-loans',
          meta: { title: 'Empréstimos negativados' },
          props: { fixedStatus: 'overdue' },
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
    { path:'/:pathMatch(.*)*',redirect:'/' },
  ],
})

router.beforeEach(async (to) => {
  const user = await restoreAuth()
  if (!user && !to.meta.public) return {name:'login'}
  if (user && to.meta.public) return {name:'dashboard'}
  if (to.meta.admin && !canAdminister(user)) return {name:'dashboard'}
})
onSessionExpired(() => {
  if (router.currentRoute.value.matched.length && !router.currentRoute.value.meta.public)
    router.replace({name:'login'})
})

export default router
