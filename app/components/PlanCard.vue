<script setup lang="ts">
import IconScribble from './IconScribble.vue'
import RBadge from './rough/RBadge.vue'
import RButton from './rough/RButton.vue'
import RoughFrame from './rough/RoughFrame.vue'
import type { Contact, PlanWithStats } from '../utils/crm'
import { PLAN_STATUS_META, planWindow, type PlanStatus } from '#shared/utils/planEval'

// 一張計畫卡：視覺優先——現象→方法用圖示串流，覆核窗內成效用圓環，
// 數據是圖示＋tabular 數字，圈選對象是頭像堆疊。操作由父層處理。
const props = defineProps<{ plan: PlanWithStats, contacts: Contact[], today: string }>()
const emit = defineEmits<{
  edit: [plan: PlanWithStats]
  status: [plan: PlanWithStats, status: PlanStatus]
  remove: [plan: PlanWithStats]
}>()

const meta = computed(() => PLAN_STATUS_META[props.plan.status])

// 方法 → 圖示（關鍵字比對，找不共用飛鏢靶）
function methodIcon(method: string | null): string {
  const m = (method ?? '').toLowerCase()
  if (/廣告|投放|廣告投放/.test(m)) return 'megaphone'
  if (/line|訊息|私訊/.test(m)) return 'chat'
  if (/ig|限動|貼文|粉專|動態/.test(m)) return 'story'
  if (/群發|紙飛機|广播|廣播/.test(m)) return 'send'
  if (/電話|call|打/.test(m)) return 'phone'
  if (/見|約|吃|咖啡|面/.test(m)) return 'cup'
  return 'target'
}

// 覆核窗（簡短日期：MM/DD，沒排定退回建立日）
const md = (iso: string) => `${iso.slice(5, 7)}/${iso.slice(8, 10)}`
const windowLabel = computed(() => {
  const { from, to } = planWindow({ audience: [], startDate: props.plan.startDate, endDate: props.plan.endDate, createdAt: props.plan.createdAt })
  const created = !props.plan.startDate
  const toLabel = to ? md(to) : '今'
  return created ? `建於 ${md(from)} → ${toLabel}` : `${md(from)} → ${toLabel}`
})

// 頭像堆疊：姓名首字，最多 5 顆＋剩餘數
const MAX_AVATARS = 5
const avatars = computed(() =>
  props.plan.audience
    .map(id => props.contacts.find(c => c.id === id)?.name)
    .filter((n): n is string => !!n)
    .slice(0, MAX_AVATARS)
)
const avatarRest = computed(() => Math.max(0, props.plan.stats.audienceCount - avatars.value.length))

// 圓環：周長 2πr（r=42），dasharray 依比例
const CIRC = 2 * Math.PI * 42
const dash = computed(() => `${(props.plan.stats.rate / 100) * CIRC} ${CIRC}`)
</script>

<template>
  <RoughFrame class="plan-card">
    <div class="plan-card__content">
      <div class="plan-card__head">
        <h3 class="plan-card__title">
          {{ plan.name }}
        </h3>
        <RBadge :tone="meta.tone">
          {{ meta.label }}
        </RBadge>
      </div>

      <p class="plan-thesis">
        <template v-if="plan.insight || plan.method">
          <span
            v-if="plan.insight"
            class="plan-chip"
          >
            <IconScribble
              name="zzz"
              class="plan-chip__icon"
            />
            {{ plan.insight }}
          </span>
          <IconScribble
            v-if="plan.insight && plan.method"
            name="arrow"
            label="導致打法"
            class="plan-thesis__arrow"
          />
          <span
            v-if="plan.method"
            class="plan-chip plan-chip--method"
          >
            <IconScribble
              :name="methodIcon(plan.method)"
              class="plan-chip__icon"
            />
            {{ plan.method }}
          </span>
        </template>
        <span
          v-else
          class="plan-chip plan-chip--empty"
        >
          <IconScribble
            name="target"
            class="plan-chip__icon"
          />
          待補現象與方法
        </span>
      </p>

      <div class="plan-card__body">
        <div
          class="plan-donut"
          role="img"
          :aria-label="`覆核窗內已重新接觸 ${plan.stats.reached} 人，共 ${plan.stats.audienceCount} 人，${plan.stats.rate}%`"
        >
          <svg
            viewBox="0 0 100 100"
            aria-hidden="true"
          >
            <circle
              class="plan-donut__track"
              cx="50"
              cy="50"
              r="42"
            />
            <circle
              class="plan-donut__value"
              cx="50"
              cy="50"
              r="42"
              :stroke-dasharray="dash"
            />
          </svg>
          <span class="plan-donut__pct">{{ plan.stats.rate }}%</span>
          <span class="plan-donut__frac">{{ plan.stats.reached }}/{{ plan.stats.audienceCount }}</span>
        </div>

        <div class="plan-metrics">
          <span
            class="plan-metric"
            :aria-label="`圈選 ${plan.stats.audienceCount} 位`"
          >
            <IconScribble name="users" />
            <b>{{ plan.stats.audienceCount }}</b>
            <i>圈選</i>
          </span>
          <span
            class="plan-metric"
            :aria-label="`有聯絡管道 ${plan.stats.coverage} 位，共 ${plan.stats.audienceCount} 位`"
          >
            <IconScribble name="radio" />
            <b>{{ plan.stats.coverage }}<small>/{{ plan.stats.audienceCount }}</small></b>
            <i>管道</i>
          </span>
          <span
            class="plan-metric"
            :class="{ 'is-warn': plan.stats.stalled > 0 }"
            :aria-label="`仍在停擺 ${plan.stats.stalled} 位`"
          >
            <IconScribble name="hourglass" />
            <b>{{ plan.stats.stalled }}</b>
            <i>停擺</i>
          </span>
          <span
            class="plan-metric"
            :aria-label="`超過 14 天沒聯絡 ${plan.stats.silent14} 位`"
          >
            <IconScribble name="clock" />
            <b>{{ plan.stats.silent14 }}</b>
            <i>冷卻</i>
          </span>
        </div>
      </div>

      <div class="plan-card__people">
        <span
          class="plan-avatars"
          :aria-label="`圈選對象 ${plan.stats.audienceCount} 位`"
        >
          <span
            v-for="n in avatars"
            :key="n"
            class="plan-avatar"
            :title="n"
            aria-hidden="true"
          >{{ n.slice(0, 1) }}</span>
          <span
            v-if="avatarRest > 0"
            class="plan-avatar plan-avatar--more"
            aria-hidden="true"
          >＋{{ avatarRest }}</span>
        </span>
        <span class="plan-card__window">
          <IconScribble name="calendar" />
          {{ windowLabel }}
        </span>
      </div>

      <p
        v-if="plan.content"
        class="plan-card__note"
        :title="plan.content"
      >
        {{ plan.content }}
      </p>

      <div class="plan-card__actions">
        <RButton
          v-if="plan.status === 'planning'"
          variant="primary"
          @click="emit('status', plan, 'active')"
        >
          開始執行
        </RButton>
        <template v-else-if="plan.status === 'active'">
          <RButton @click="emit('status', plan, 'planning')">
            收回
          </RButton>
          <RButton
            variant="primary"
            @click="emit('status', plan, 'done')"
          >
            完成
          </RButton>
        </template>
        <RButton
          v-else
          @click="emit('status', plan, 'active')"
        >
          重新執行
        </RButton>

        <span class="plan-card__spacer" />
        <RButton
          class="r-button--icon"
          aria-label="編輯計畫"
          @click="emit('edit', plan)"
        >
          <IconScribble name="pencil" />
        </RButton>
        <RButton
          class="r-button--icon"
          variant="danger"
          aria-label="刪除計畫"
          @click="emit('remove', plan)"
        >
          <IconScribble name="trash" />
        </RButton>
      </div>
    </div>
  </RoughFrame>
</template>
