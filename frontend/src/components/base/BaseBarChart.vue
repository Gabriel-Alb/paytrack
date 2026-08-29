<template>
    <article
        class="overflow-hidden rounded-xl border border-black/[0.07] bg-white p-4 sm:p-6"
    >
        <header class="flex items-start justify-between gap-4">
            <div class="min-w-0">
                <h2
                    class="truncate text-[15px] font-semibold tracking-[-0.02em] text-[#27272a] sm:text-base"
                >
                    {{ title }}
                </h2>

                <p
                    v-if="description"
                    class="mt-1 text-[10px] text-[#8b8b93] sm:text-xs"
                >
                    {{ description }}
                </p>
            </div>

            <slot name="header-action">
                <span
                    v-if="badge"
                    class="shrink-0 rounded-md bg-[#edf7ef] px-2 py-1 text-[9px] font-semibold text-[#166534] sm:text-[10px]"
                >
                    {{ badge }}
                </span>
            </slot>
        </header>

        <div class="mt-4 sm:mt-6">
            <div class="mx-auto w-full sm:max-w-[720px]">
                <VueApexCharts
                    type="bar"
                    width="100%"
                    :height="chartHeight"
                    :options="chartOptions"
                    :series="series"
                />
            </div>
        </div>
    </article>
</template>

<script setup>
import { computed, ref } from 'vue'
import VueApexCharts from 'vue3-apexcharts'

const props = defineProps({
    title: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        default: '',
    },
    badge: {
        type: String,
        default: '',
    },
    items: {
        type: Array,
        required: true,
    },
    seriesName: {
        type: String,
        default: 'Valor',
    },
    height: {
        type: Number,
        default: 280,
    },
    valueFormatter: {
        type: Function,
        default: (value) => String(value),
    },
})

const selectedIndex = ref(null)

const chartHeight = computed(() => props.height)

const series = computed(() => [
    {
        name: props.seriesName,
        data: props.items.map((item) => Number(item.value) || 0),
    },
])

const categories = computed(() => {
    return props.items.map((item) => item.label)
})

const barColors = computed(() => {
    return props.items.map((item) =>
        item.highlight ? '#166534' : '#a8d56f',
    )
})

const toggleSelectedBar = (index) => {
    selectedIndex.value =
        selectedIndex.value === index
            ? null
            : index
}

const chartOptions = computed(() => ({
    chart: {
        type: 'bar',
        background: 'transparent',
        toolbar: {
            show: false,
        },
        zoom: {
            enabled: false,
        },
        animations: {
            enabled: true,
            easing: 'easeout',
            speed: 550,
            animateGradually: {
                enabled: true,
                delay: 70,
            },
            dynamicAnimation: {
                enabled: true,
                speed: 300,
            },
        },
        events: {
            dataPointSelection: (_event, _chartContext, config) => {
                toggleSelectedBar(config.dataPointIndex)
            },
        },
    },

    series: series.value,

    colors: barColors.value,

    plotOptions: {
        bar: {
            horizontal: false,
            distributed: true,
            columnWidth: '42%',
            borderRadius: 5,
            borderRadiusApplication: 'end',
        },
    },

    dataLabels: {
        enabled: true,
        offsetY: -10,
        formatter: (value, options) => {
            if (options.dataPointIndex !== selectedIndex.value) {
                return ''
            }

            return props.valueFormatter(value)
        },
        style: {
            fontSize: '10px',
            fontWeight: 600,
            colors: ['#ffffff'],
        },
        background: {
            enabled: true,
            foreColor: '#ffffff',
            borderRadius: 5,
            padding: 6,
            opacity: 1,
            borderWidth: 0,
        },
        dropShadow: {
            enabled: true,
            top: 2,
            left: 0,
            blur: 4,
            opacity: 0.12,
        },
    },

    stroke: {
        show: false,
    },

    grid: {
        show: true,
        borderColor: 'rgba(0, 0, 0, 0.06)',
        strokeDashArray: 4,
        position: 'back',
        padding: {
            top: 18,
            right: 8,
            bottom: 0,
            left: 8,
        },
        xaxis: {
            lines: {
                show: false,
            },
        },
        yaxis: {
            lines: {
                show: true,
            },
        },
    },

    xaxis: {
        categories: categories.value,
        axisBorder: {
            show: true,
            color: 'rgba(0, 0, 0, 0.08)',
        },
        axisTicks: {
            show: false,
        },
        labels: {
            show: true,
            trim: false,
            hideOverlappingLabels: false,
            style: {
                colors: categories.value.map(() => '#8b8b93'),
                fontSize: '11px',
                fontWeight: 500,
            },
        },
        tooltip: {
            enabled: false,
        },
    },

    yaxis: {
        show: false,
        min: 0,
    },

    tooltip: {
        enabled: true,
        shared: false,
        intersect: true,
        theme: 'light',
        followCursor: false,
        marker: {
            show: false,
        },
        style: {
            fontSize: '11px',
        },
        x: {
            show: true,
        },
        y: {
            formatter: (value) => props.valueFormatter(value),
            title: {
                formatter: () => '',
            },
        },
    },

    legend: {
        show: false,
    },

    states: {
        normal: {
            filter: {
                type: 'none',
            },
        },
        hover: {
            filter: {
                type: 'lighten',
                value: 0.08,
            },
        },
        active: {
            allowMultipleDataPointsSelection: false,
            filter: {
                type: 'darken',
                value: 0.08,
            },
        },
    },

    responsive: [
        {
            breakpoint: 640,
            options: {
                chart: {
                    height: 235,
                },
                plotOptions: {
                    bar: {
                        columnWidth: '58%',
                        borderRadius: 4,
                    },
                },
                grid: {
                    padding: {
                        top: 18,
                        right: 0,
                        left: 0,
                    },
                },
                xaxis: {
                    labels: {
                        style: {
                            fontSize: '9px',
                        },
                    },
                },
                dataLabels: {
                    offsetY: -8,
                    style: {
                        fontSize: '9px',
                    },
                    background: {
                        padding: 5,
                    },
                },
                tooltip: {
                    style: {
                        fontSize: '10px',
                    },
                },
            },
        },
    ],
}))
</script>

<style>
.apexcharts-canvas {
    margin: 0 auto;
}

.apexcharts-tooltip {
    border: 0 !important;
    border-radius: 7px !important;
    box-shadow: 0 6px 18px rgb(0 0 0 / 10%) !important;
}

.apexcharts-tooltip-title {
    border-bottom: 1px solid rgb(0 0 0 / 5%) !important;
    background: #fafafa !important;
    font-weight: 600 !important;
}

.apexcharts-xaxis-label {
    transition: fill 150ms ease;
}
</style>