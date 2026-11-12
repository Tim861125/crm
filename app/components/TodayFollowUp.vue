<script setup lang="ts">
import RBadge from '../components/rough/RBadge.vue'
import RButton from '../components/rough/RButton.vue'
import RCard from '../components/rough/RCard.vue'
import RoughFrame from '../components/rough/RoughFrame.vue'
import {
  api,
  todayStr,
  timeAgo,
  type Contact,
  type FollowUpLog
} from '../utils/crm'
import { isTodayFollowUp, leadScore, topReason, type LeadReason } from '#shared/utils/leadScore'

// 今日跟進智慧清單：用透明的熱度分數回答「今天先找誰」。
// 入列 = 逾期 ∪ 今天到期 ∪ 待啟動；排序 = 熱度分數（越大越前）。
// 勾選「跟進完成」＝直接記一筆今天的跟進紀錄。
const props = defineProps<{ refresh?: () => void, tick?: number }>()

const emit = defineEmits<{ detail: [contact: Contact] }>()

const { flash } = useNotice()

const { data: contacts, refresh: refreshContacts } = useFetch<Contact[]>('/api/contacts', { default: () => [] })

// 頁面 tick 變動（明細 modal 儲存後）→ 重抓
watch(() => props.tick, () => refreshContacts())

const today = todayStr()

const followUps = computed(() =>
  (contacts.value || [])
    .filter(c => isTodayFollowUp(c, today))
    .map(c => ({ contact: c, score: leadScore(c, today), reason: topReason(c, today) }))
    .sort((a, b) => b.score - a.score)
)

async function markDone(entry: { contact: Contact }) {
  const c = entry.contact
  try {
    await api<FollowUpLog>(`/api/contacts/${c.id}/logs`, {
      method: 'POST',
      body: { date: todayStr(), content: null }
    })
    flash(`記好了 ✏️「${c.name}」今天跟進完成`)
    refreshContacts()
    props.refresh?.()
  } catch (err: unknown) {
    flash(`記錄跟進失敗：${(err as Error)?.message}`, { error: true })
  }
}

function reasonTone(reason: LeadReason): 'red' | 'yellow' | 'gray' {
  if (!reason) return 'gray'
  if (reason.kind === 'overdue') return 'red'
  if (reason.kind === 'due') return 'yellow'
  return 'gray'
}

const showAll = ref(false)
const STEP = 8
const visible = computed(() =>
  showAll.value ? followUps.value : followUps.value.slice(0, STEP)
)
</script>

<template>
  <div
    v-if="followUps.length"
    class="follow-list"
  >
    <RoughFrame
      v-for="(item, idx) in visible"
      :key="item.contact.id"
    >
      <div class="follow-row__content">
        <div class="follow-row__meta">
          <RBadge tone="yellow">
            {{ idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : item.score }}
          </RBadge>

          <button
            type="button"
            class="cell-edit"
            @click="emit('detail', item.contact)"
          >
            {{ item.contact.name }}
          </button>

          <RBadge
            v-if="item.reason"
            :tone="reasonTone(item.reason)"
          >
            {{ item.reason.label }}
          </RBadge>
          <RBadge
            v-if="item.contact.broached"
            tone="gray"
          >
            破題
          </RBadge>
          <span
            v-if="item.contact.followUpFreq && item.contact.followUpFreq !== '暫停'"
            class="muted-note"
          >
            {{ item.contact.followUpFreq }}
          </span>
          <span class="muted-note">最後 {{ timeAgo(item.contact.lastFollowUp) }}</span>
        </div>

        <RButton
          variant="primary"
          @click="markDone(item)"
        >
          跟進完成
        </RButton>
      </div>
    </RoughFrame>

    <button
      v-if="followUps.length > STEP"
      type="button"
      class="show-more-button"
      @click="showAll = !showAll"
    >
      {{ showAll ? '收摺 ▲' : `還有 ${followUps.length - STEP} 位… ▼` }}
    </button>
  </div>

  <RCard v-else>
    <div class="empty-state">
      今天沒有該跟進的名單。心情輕鬆 ☀️
    </div>
  </RCard>
</template>
