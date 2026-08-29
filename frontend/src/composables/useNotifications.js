import { computed, ref } from 'vue'

export const NOTIFICATION_FILTERS = [
  {
    label: 'Todas',
    value: 'all',
  },
  {
    label: 'Pagamentos',
    value: 'payment',
  },
  {
    label: 'Atrasos',
    value: 'overdue',
  },
]

const dateKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: 'America/Sao_Paulo',
})

const fullDateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  timeZone: 'America/Sao_Paulo',
})

const timeFormatter = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'America/Sao_Paulo',
})

export const formatNotificationTime = (value) => {
  return timeFormatter.format(new Date(value))
}

const formatNotificationGroup = (value) => {
  const notificationDate = new Date(value)
  const today = new Date()
  const yesterday = new Date(today)

  yesterday.setDate(today.getDate() - 1)

  const notificationKey = dateKeyFormatter.format(notificationDate)
  const todayKey = dateKeyFormatter.format(today)
  const yesterdayKey = dateKeyFormatter.format(yesterday)

  if (notificationKey === todayKey) {
    return 'Hoje'
  }

  if (notificationKey === yesterdayKey) {
    return 'Ontem'
  }

  return fullDateFormatter.format(notificationDate)
}

const groupNotifications = (notifications) => {
  return notifications.reduce((groups, notification) => {
    const label = formatNotificationGroup(notification.datetime)

    const existingGroup = groups.find((group) => group.label === label)

    if (existingGroup) {
      existingGroup.notifications.push(notification)
      return groups
    }

    groups.push({
      label,
      notifications: [notification],
    })

    return groups
  }, [])
}

export const useNotifications = (notifications) => {
  const activeFilter = ref('all')

  const filteredNotifications = computed(() => {
    if (activeFilter.value === 'all') {
      return notifications
    }

    return notifications.filter((notification) => notification.type === activeFilter.value)
  })

  const groupedNotifications = computed(() => {
    return groupNotifications(filteredNotifications.value)
  })

  return {
    activeFilter,
    filters: NOTIFICATION_FILTERS,
    groupedNotifications,
  }
}
