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
                to: '/loans/paid',
            },
            {
                label: 'Negativados',
                icon: mdiAlertCircleOutline,
                to: '/loans/overdue',
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
    {
        label: 'Relatórios',
        icon: mdiChartBoxOutline,
        to: '/reports',
    },

]
