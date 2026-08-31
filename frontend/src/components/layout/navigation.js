import {
    mdiAccountGroupOutline,
    mdiAlertCircleOutline,
    mdiCashMultiple,
    mdiChartBoxOutline,
    mdiCheckCircleOutline,
    mdiCreditCardOutline,
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
                label: 'Pagamentos',
                icon: mdiCreditCardOutline,
            },
        ],
    },
    {
        title: 'Gestão',
        items: [
            {
                label: 'Quitados',
                icon: mdiCheckCircleOutline,
            },
            {
                label: 'Inadimplentes',
                icon: mdiAlertCircleOutline,
            },
            {
                label: 'Relatórios',
                icon: mdiChartBoxOutline,
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
    },
    {
        label: 'Empréstimos',
        icon: mdiCashMultiple,
    },
    {
        label: 'Pagamentos',
        icon: mdiCreditCardOutline,
    },
]