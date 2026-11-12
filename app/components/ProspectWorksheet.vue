<script setup lang="ts">
import RBadge from '../components/rough/RBadge.vue'
import RButton from '../components/rough/RButton.vue'
import RCard from '../components/rough/RCard.vue'
import RSelect from '../components/rough/RSelect.vue'
import {
  api,
  PROSPECT_SECTION_META,
  PROSPECT_SECTIONS,
  todayStr,
  type Contact,
  type Prospect,
  type ProspectSection
} from '../utils/crm'

const emit = defineEmits<{ detail: [contact: Contact] }>()
const props = defineProps<{ tick?: number }>()

const { flash } = useNotice()

// ── 資料 ─────────────────────────────────────────────────────
const { data: prospects, status: prospectsStatus, refresh: refreshProspects } = useFetch<Prospect[]>('/api/prospects', { default: () => [] })
const { data: contacts, refresh: refreshContacts } = useFetch<Contact[]>('/api/contacts', { default: () => [] })

// 頁面 tick 變動（明細 modal 儲存後）→ 全部重抓
watch(() => props.tick, () => {
  refreshProspects()
  refreshContacts()
})

const bySection = (section: ProspectSection) =>
  (prospects.value || []).filter(p => p.section === section)

// ── 新增列（冪等：同區塊同人不重複）───────────────────────────
const picking = ref<Record<ProspectSection, string>>({
  develop: '',
  reserve: '',
  five: '',
  network: ''
})

const contactItems = computed(() => [
  { label: '挑一位名單對象…', value: '' },
  ...(contacts.value || []).map(c => ({ label: c.name, value: String(c.id) }))
])

// 等級徽章：SSR 紅、SR 黃、其他灰
function levelTone(level: string | null): 'red' | 'yellow' | 'gray' {
  if (level === 'SSR') return 'red'
  if (level === 'SR') return 'yellow'
  return 'gray'
}

async function addRow(section: ProspectSection) {
  const contactId = picking.value[section] ? Number(picking.value[section]) : null
  if (!contactId) return
  try {
    await api<Prospect>('/api/prospects', {
      method: 'POST',
      body: { section, contactId, date: todayStr() }
    })
    picking.value[section] = ''
    await refreshProspects()
  } catch (err: unknown) {
    flash(`加入區塊失敗：${(err as Error)?.message ?? '加入失敗'}`, { error: true })
  }
}

async function removeRow(row: Prospect) {
  if (!window.confirm(`要把「${row.contact.name}」從區塊移除嗎？（總名單裡的人不會被刪除）`)) return
  try {
    await api(`/api/prospects/${row.id}`, { method: 'DELETE' })
    await refreshProspects()
  } catch (err: unknown) {
    flash(`移除失敗：${(err as Error)?.message}`, { error: true })
  }
}

// ── 日期（這一列自己的）───────────────────────────────────────
async function patchRow(row: Prospect, date: string | null) {
  try {
    await api(`/api/prospects/${row.id}`, { method: 'PATCH', body: { date: date || null } })
    await refreshProspects()
  } catch (err: unknown) {
    flash(`更新日期失敗：${(err as Error)?.message}`, { error: true })
  }
}

// ── contact 欄位修改（狀態，失焦時提交）───────────────────────
async function patchContact(c: Contact, key: 'level' | 'status', value: string) {
  try {
    await api<Contact>(`/api/contacts/${c.id}`, { method: 'PATCH', body: { [key]: value || null } })
    await refreshContacts()
    await refreshProspects()
  } catch (err: unknown) {
    flash(`更新「${c.name}」失敗：${(err as Error)?.message}`, { error: true })
  }
}
</script>

<template>
  <div class="worksheet">
    <RCard
      v-for="section in PROSPECT_SECTIONS"
      :key="section"
    >
      <div class="section-head">
        <h2>{{ PROSPECT_SECTION_META[section].icon }} {{ PROSPECT_SECTION_META[section].title }}</h2>
        <span class="section-hint">{{ PROSPECT_SECTION_META[section].hint }}</span>
      </div>

      <!-- 新增列 -->
      <form
        class="inline-form"
        @submit.prevent="addRow(section)"
      >
        <RSelect
          v-model="picking[section]"
          :aria-label="`加入「${PROSPECT_SECTION_META[section].title}」區塊的名單對象`"
          :options="contactItems"
        />
        <RButton
          variant="primary"
          type="submit"
          :disabled="!picking[section]"
        >
          放進來
        </RButton>
      </form>

      <!-- 區塊列 -->
      <table class="r-table">
        <tbody>
          <tr
            v-for="row in bySection(section)"
            :key="row.id"
          >
            <td>
              <button
                type="button"
                class="cell-edit"
                @click="emit('detail', row.contact)"
              >
                {{ row.contact.name }}
              </button>
            </td>

            <td>
              <RBadge
                v-if="row.contact.level"
                :tone="levelTone(row.contact.level)"
              >
                {{ row.contact.level }}
              </RBadge>
            </td>

            <td>
              <span
                v-if="row.contact.friendOf"
                class="muted-note"
              >跟 {{ row.contact.friendOf }} 一組</span>
            </td>

            <td>
              <input
                class="cell-input"
                :value="row.contact.status ?? ''"
                placeholder="狀態…"
                :aria-label="`「${row.contact.name}」的狀態`"
                @change="patchContact(row.contact, 'status', ($event.target as HTMLInputElement).value)"
              >
            </td>

            <td>
              <input
                class="cell-input cell-input--wide"
                type="date"
                :value="row.date ?? ''"
                :aria-label="`「${row.contact.name}」這一列的跟進日期`"
                @change="patchRow(row, ($event.target as HTMLInputElement).value || null)"
              >
            </td>

            <td>
              <button
                type="button"
                class="row-step row-step--danger"
                title="移出區塊"
                :aria-label="`將「${row.contact.name}」移出${PROSPECT_SECTION_META[section].title}`"
                @click="removeRow(row)"
              >
                ×
              </button>
            </td>
          </tr>

          <tr v-if="prospectsStatus === 'pending' && !prospects.length">
            <td
              colspan="6"
              class="empty-cell"
            >
              載入中…
            </td>
          </tr>
          <tr v-else-if="!bySection(section).length">
            <td
              colspan="6"
              class="empty-cell"
            >
              還空的，挑人放進來 🌱
            </td>
          </tr>
        </tbody>
      </table>
    </RCard>
  </div>
</template>
