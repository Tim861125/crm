<script setup lang="ts">
import {
  apiArr,
  PROSPECT_SECTION_META,
  PROSPECT_SECTIONS,
  todayStr,
  type Contact,
  type Prospect,
  type ProspectSection
} from '../utils/crm'
import { levelColor } from '../utils/crm'

const emit = defineEmits<{ detail: [contact: Contact] }>()
const props = defineProps<{ tick?: number }>()

const toast = useToast()

// ── 資料 ─────────────────────────────────────────────────────
const { data: prospects, refresh: refreshProspects } = useFetch<Prospect[]>('/api/prospects', { default: () => [] })
const { data: contacts, refresh: refreshContacts } = useFetch<Contact[]>('/api/contacts', { default: () => [] })

// 頁面 tick 變動（明細 modal 儲存後）→ 全部重抓
watch(() => props.tick, () => {
  refreshProspects()
  refreshContacts()
})

const bySection = (section: ProspectSection) =>
  (prospects.value || []).filter(p => p.section === section)

// ── 新增列（冪等：同區塊同人不重複）───────────────────────────
const picking = ref<Record<ProspectSection, { label: string, value: number } | undefined>>({
  develop: undefined,
  reserve: undefined,
  five: undefined,
  network: undefined
})

const contactItems = computed(() =>
  (contacts.value || []).map(c => ({ label: c.name, value: c.id }))
)

async function addRow(section: ProspectSection) {
  const contactId = picking.value[section]?.value ?? null
  if (!contactId) return
  try {
    await apiArr<Prospect>('/api/prospects', {
      method: 'POST',
      body: { section, contactId, date: todayStr() }
    })
    picking.value[section] = undefined
    await refreshProspects()
  } catch (err: unknown) {
    const msg = (err as Error)?.message ?? '加入失敗'
    toast.add({ title: '加入區塊失敗', description: msg, color: 'error' })
  }
}

async function removeRow(row: Prospect) {
  if (!window.confirm(`要把「${row.contact.name}」從區塊移除嗎？（總名單裡的人不會被刪除）`)) return
  try {
    await apiArr(`/api/prospects/${row.id}`, { method: 'DELETE' })
    await refreshProspects()
  } catch (err: unknown) {
    toast.add({ title: '移除失敗', description: (err as Error)?.message, color: 'error' })
  }
}

// ── 日期（這一列自己的）───────────────────────────────────────
async function patchRow(row: Prospect, date: string | null) {
  try {
    await apiArr(`/api/prospects/${row.id}`, { method: 'PATCH', body: { date: date || null } })
    await refreshProspects()
  } catch (err: unknown) {
    toast.add({ title: '更新日期失敗', description: (err as Error)?.message, color: 'error' })
  }
}

// ── contact 欄位 inline 修改（等級／狀態）─────────────────────
async function patchContact(c: Contact, key: 'level' | 'status', value: string) {
  try {
    await apiArr<Contact>(`/api/contacts/${c.id}`, { method: 'PATCH', body: { [key]: value || null } })
    await refreshContacts()
    await refreshProspects()
  } catch (err: unknown) {
    toast.add({ title: `更新「${c.name}」失敗`, description: (err as Error)?.message, color: 'error' })
  }
}
</script>

<template>
  <div class="grid gap-4 grid-cols-1 xl:grid-cols-2">
    <section
      v-for="section in PROSPECT_SECTIONS"
      :key="section"
      class="sketch-card p-3"
    >
      <div class="flex items-center justify-between gap-2 mb-2">
        <h2 class="font-bold text-lg">
          {{ PROSPECT_SECTION_META[section].icon }} {{ PROSPECT_SECTION_META[section].title }}
        </h2>
        <span class="text-xs text-muted">{{ PROSPECT_SECTION_META[section].hint }}</span>
      </div>

      <!-- 新增列 -->
      <form
        class="flex flex-wrap gap-2 mb-3"
        @submit.prevent="addRow(section)"
      >
        <USelectMenu
          v-model="picking[section]"
          :items="contactItems"
          placeholder="挑一位名單對象…"
          size="sm"
          class="grow min-w-40 sketch-chip"
        />
        <UButton
          type="submit"
          size="sm"
          color="primary"
          class="sketch-chip"
          :disabled="!picking[section]"
        >
          放進來
        </UButton>
      </form>

      <!-- 區塊列 -->
      <table class="sketch-table w-full text-sm">
        <tbody>
          <tr
            v-for="row in bySection(section)"
            :key="row.id"
          >
            <td class="py-2 px-1.5 font-bold align-top min-w-20">
              <button
                class="hover:underline decoration-wavy"
                @click="emit('detail', row.contact)"
              >
                {{ row.contact.name }}
              </button>
            </td>

            <td class="py-2 px-1.5 align-top">
              <UBadge
                v-if="row.contact.level"
                :color="levelColor(row.contact.level)"
                variant="outline"
                class="sketch-chip"
              >
                {{ row.contact.level }}
              </UBadge>
            </td>

            <td class="py-2 px-1.5 align-top text-muted">
              {{ row.contact.friendOf ? `跟 ${row.contact.friendOf} 一組` : '' }}
            </td>

            <td class="py-2 px-1.5 align-top min-w-32">
              <UInput
                :model-value="row.contact.status ?? ''"
                placeholder="狀態…"
                size="xs"
                variant="none"
                class="w-32"
                @update:model-value="v => patchContact(row.contact, 'status', String(v))"
              />
            </td>

            <td class="py-2 px-1.5 align-top">
              <UInput
                :model-value="row.date ?? ''"
                type="date"
                size="xs"
                variant="none"
                class="w-36"
                @update:model-value="v => patchRow(row, String(v) || null)"
              />
            </td>

            <td class="py-2 px-1.5 align-top w-8">
              <UButton
                icon="i-lucide-x"
                size="xs"
                variant="ghost"
                color="error"
                title="移出區塊"
                @click="removeRow(row)"
              />
            </td>
          </tr>

          <tr v-if="!bySection(section).length">
            <td
              colspan="6"
              class="py-4 text-center text-muted text-sm"
            >
              還空的，挑人放進來 🌱
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>
