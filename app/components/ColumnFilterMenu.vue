<script setup lang="ts">
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import RCheckbox from './rough/RCheckbox.vue'
import RoughFrame from './rough/RoughFrame.vue'

// 總名單欄頭多選篩選：欄位標題本身就是觸發鈕，點開勾選面板（同欄多選＝任一符合；空選＝該欄不篩）。
// 選項與筆數由父層從實際資料推導；試算表式行為——勾選不收合面板，點外側／Esc 才關。
// 面板借 .r-pop-menu 手繪風樣式（與 RSelect／RCombobox 同款，見 main.css）。
interface FilterOption {
  value: string
  label: string
  count: number
}

const props = withDefaults(defineProps<{ label: string, options: FilterOption[], active?: boolean }>(), { active: false })
const model = defineModel<string[]>({ default: () => [] })
const open = ref(false)

function toggle(value: string) {
  model.value = model.value.includes(value)
    ? model.value.filter(v => v !== value)
    : [...model.value, value]
}
function clear() {
  model.value = []
}
</script>

<template>
  <PopoverRoot v-model:open="open">
    <!-- 「已套用篩選」折進 aria-label：aria-label 整串取代按鈕由內文計算的可及名稱，內層 sr-only 文字不會被朗讀 -->
    <PopoverTrigger
      as-child
      :aria-label="`以「${props.label}」篩選（可多選）${props.active ? '，已套用篩選' : ''}`"
    >
      <button
        type="button"
        class="th-filter"
        :class="{ 'is-active': props.active }"
      >
        <span>{{ props.label }}</span>
        <!-- 手繪感漏斗（純描線，比照表頭齒輪／垃圾桶風格） -->
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
        </svg>
      </button>
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        class="r-pop-menu"
        position="popper"
        :side-offset="8"
        align="start"
        :collision-padding="10"
        :aria-label="`「${props.label}」篩選選項`"
      >
        <RoughFrame class="r-filter__panel r-pop-menu__panel">
          <div class="r-pop-menu__viewport">
            <div
              v-for="opt in props.options"
              :key="opt.value"
              class="r-filter__row"
            >
              <RCheckbox
                :model-value="model.includes(opt.value)"
                @update:model-value="toggle(opt.value)"
              >
                <span>{{ opt.label }}</span>
              </RCheckbox>
              <span class="r-filter__count">{{ opt.count }}</span>
            </div>
            <p
              v-if="!props.options.length"
              class="r-pop-menu__empty"
            >
              尚無可篩選的值
            </p>
            <button
              v-if="model.length"
              type="button"
              class="r-filter__clear"
              @click="clear"
            >
              清除已選（{{ model.length }}）
            </button>
          </div>
        </RoughFrame>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
