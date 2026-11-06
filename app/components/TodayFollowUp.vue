<script setup lang="ts">
import {
  apiArr,
  todayStr,
  timeAgo,
  type Contact,
  type FollowUpLog
} from '../utils/crm'
import { isTodayFollowUp, leadScore, topReason, type LeadReason } from '../../shared/utils/leadScore'

// 今日跟進智慧清單：用透明的熱度分數回答「今天先找誰」。
// 入列 = 逾期 ∪ 今天到期 ∪ 待啟動；排序 = 熱度分數（越大越前）。
// 勾選「跟進完成」＝直接記一筆今天的跟進紀錄。
const props = defineProps<{ refresh?: () => void, tick?: number }>()

const emit = defineEmits<{ detail: [contact: Contact] }>()

const toast = useToast()

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
    await apiArr<FollowUpLog>(`/api/contacts/${c.id}/logs`, {
      method: 'POST',
      body: { date: todayStr(), content: null }
    })
    toast.add({ title: `記好了 ✏️「${c.name}」今天跟進完成`, color: 'neutral' })
    refreshContacts()
    props.refresh?.()
  } catch (err: unknown) {
    toast.add({ title: '記錄跟進失敗', description: (err as Error)?.message, color: 'error' })
  }
}

function reasonChipClass(reason: LeadReason): string {
  if (!reason) return 'sketch-chip'
  if (reason.kind === 'overdue') return 'sketch-chip marker-red px-1.5'
  if (reason.kind === 'due') return 'sketch-chip marker px-1.5'
  return 'sketch-chip px-1.5'
}

const showAll = ref(false)
const STEP = 8
const visible = computed(() =>
  showAll.value ? followUps.value : followUps.value.slice(0, STEP)
)
</script>

<template>
  <div class="grid gap-2">
    <template v-if="followUps.length">
      <div
        v-for="(item, idx) in visible"
        :key="item.contact.id"
        class="sketch-card-alt flex items-center justify-between gap-2 px-3 py-2"
      >
        <div class="flex flex-wrap items-center gap-2">
          <span class="sketch-chip shrink-0 inline-flex items-center justify-center px-1.5 min-w-10 font-bold">
            {{ idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : item.score }}
          </span>

          <button
            class="font-bold text-base hover:underline decoration-wavy"
            @click="emit('detail', item.contact)"
          >
            {{ item.contact.name }}
          </button>

          <span
            class="text-xs"
            :class="reasonChipClass(item.reason)"
          >{{ item.reason?.label }}</span>
          <span
            v-if="item.contact.broached"
            class="sketch-chip px-1.5 text-xs text-muted"
          >破題</span>
          <span
            v-if="item.contact.followUpFreq && item.contact.followUpFreq !== '暫停'"
            class="text-xs text-muted"
          >
            {{ item.contact.followUpFreq }}
          </span>
          <span class="text-xs text-muted">最後 {{ timeAgo(item.contact.lastFollowUp) }}</span>
        </div>

        <UButton
          size="sm"
          color="primary"
          class="sketch-chip shrink-0"
          @click="markDone(item)"
        >
          ✅ 跟進完成
        </UButton>
      </div>

      <button
        v-if="followUps.length > STEP"
        class="text-sm underline decoration-wavy text-muted w-fit mx-auto"
        @click="showAll = !showAll"
      >
        {{ showAll ? '收摺 ▲' : `還有 ${followUps.length - STEP} 位… ▼` }}
      </button>
    </template>

    <div
      v-else
      class="sketch-card p-8 text-center text-muted"
    >
      今天沒有該跟進的名單。心情輕鬆 ☀️
    </div>
  </div>
</template>
