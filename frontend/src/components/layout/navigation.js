import {
    mdiAccountGroupOutline,
    mdiAlertCircleOutline,
    mdiCashMultiple,
    mdiChartBoxOutline,
    mdiCheckCircleOutline,
    mdiHomeOutline,
    mdiViewDashboardOutline,
} from '@mdi/js'

export const navigationSections = [
    {
        title: 'Principal',
        items: [
            {
                label: 'Dashboard',
                icon: mdiViewDashboardOutline,
                to: '/',
            },
            {
                label: 'Gestão de clientes',
                icon: mdiAccountGroupOutline,
                to: '/clients',
            },
            {
                label: 'Empréstimos',
                icon: mdiCashMultiple,
                to: '/loans',
            },

        ],
    },
    {
        title: 'Gestão',
        items: [
            {
                label: 'Quitados',
                icon: mdiCheckCircleOutline,
                to: '/clients?status=quitado',
            },
            {
                label: 'Inadimplentes',
                icon: mdiAlertCircleOutline,
                to: '/clients?status=negativado',
            },
            {
                label: 'Relatórios',
                icon: mdiChartBoxOutline,
                to: '/reports',
            },
        ],
    },
]

export const mobileNavigationItems = [
    {
        label: 'Início',
        icon: mdiHomeOutline,
        to: '/',
    },
    {
        label: 'Clientes',
        icon: mdiAccountGroupOutline,
        to: '/clients',
    },
    {
        label: 'Empréstimos',
        icon: mdiCashMultiple,
        to: '/loans',
    },

]
