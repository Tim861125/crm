// 驗證總名單「進度欄每一筆都排在同一行」（stageChipsRowWidth → --stages-w → 表格 min-width）：
//   1. 每一列的階段 chip 全在同一水平線（不出現第二行）
//   2. chip 與其餘儲存格內容都不溢出自己的欄（不被裁、不壓到相鄰欄）
//   3. 既有階段下，桌面寬度不出現橫向滾輪（聯絡／目標欄已窄化騰出進度欄空間）
//   4. 階段多到真的裝不下時才整表橫滾，而不是把 chip 折行
//   5. 全程無 pageerror
// 用法：先起 dev server（localhost:1138），再 bun tests/manual/stage-row-one-line-verify.mjs
// 加測的探针階段（一般中文階段名）測完刪除，不動既有階段與名單
import puppeteer from 'puppeteer-core'

const APP = 'http://localhost:1138/'
const CHROME = process.env.CHROME_PATH ?? (
  process.platform === 'darwin'
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : '/usr/bin/google-chrome'
)
const sleep = ms => new Promise(r => setTimeout(r, ms))
const errors = []
const failures = []

function check(name, ok, note = '') {
  console.log(`${ok ? '✓' : '✗'} ${name}${note ? `（${note}）` : ''}`)
  if (!ok) failures.push(name)
}

const PROBE_LABELS = ['已破題', '約見面', '開單', '後續追蹤', '轉介紹']

const post = async (url, body) => (await (await fetch(`${APP}${url}`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body)
})).json())

// 每一列：chip 數、chip 占幾條水平線、任何儲存格內容溢出欄寬的量
const pageProbe = () => {
  const sc = document.querySelector('.list-scroll')
  const t = sc.querySelector('.r-table')
  const rows = [...sc.querySelectorAll('tbody tr')].filter(tr => tr.querySelector('.cell-stages'))
  const chipRows = rows.map((tr) => {
    const chips = [...tr.querySelectorAll('.cell-stages .stage-chip')]
    return { chips: chips.length, lines: new Set(chips.map(c => Math.round(c.getBoundingClientRect().top))).size }
  })
  const bleeds = []
  for (const tr of rows) {
    [...tr.children].forEach((td, i) => {
      const cs = getComputedStyle(td)
      const inner = td.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
      const widest = [...td.children].reduce((m, el) => Math.max(m, el.getBoundingClientRect().width), 0)
      if (widest - inner > 1) bleeds.push(`列${rows.indexOf(tr) + 1}欄${i + 1}+${(widest - inner).toFixed(1)}`)
    })
  }
  return {
    chipRows,
    bleeds,
    overflow: +(sc.scrollWidth - sc.clientWidth).toFixed(1),
    tableW: +t.getBoundingClientRect().width.toFixed(1),
    stagesW: getComputedStyle(t).getPropertyValue('--stages-w').trim()
  }
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage']
})
const page = await browser.newPage()
page.on('pageerror', e => errors.push(e.message))

async function atWidth(width, tag) {
  await page.setViewport({ width, height: 900 })
  await page.goto(APP, { waitUntil: 'networkidle0', timeout: 30000 })
  await sleep(1000) // 等 useFetch 與手繪字體就位（字體影響 chip 寬度）
  await page.evaluate(() => document.fonts.ready)
  const r = await page.evaluate(pageProbe)
  const withChips = r.chipRows.filter(x => x.chips > 0)
  check(`${tag} w${width}：有階段可測`, withChips.length > 0, `${withChips.length} 列`)
  check(`${tag} w${width}：每列 chip 只占一條水平線`, withChips.every(x => x.lines === 1),
    withChips.map(x => `${x.chips}顆:${x.lines}行`).join(' '))
  check(`${tag} w${width}：無儲存格內容溢出欄寬`, r.bleeds.length === 0, r.bleeds.join(' '))
  console.log(`  ${tag} w${width}：表寬 ${r.tableW}／橫滾 ${r.overflow}／--stages-w ${r.stagesW}`)
  return r
}

const created = []
try {
  // 既有階段（使用者的真實階段名）：進度一行之外，桌面不得出現橫向滾輪
  for (const w of [1440, 1280, 1190]) {
    const r = await atWidth(w, '既有階段')
    if (w >= 1190) check(`既有階段 w${w}：桌面不出現滾輪`, r.overflow === 0, `橫滾 ${r.overflow}`)
  }

  // 加五個一般中文階段名：仍必須一行；此時寬度不夠就整表橫滾（不是折行）
  const existingCount = (await (await fetch(`${APP}api/contact-stages`)).json()).length
  for (const label of PROBE_LABELS) created.push(await post('api/contact-stages', { label }))
  const many = await atWidth(1280, `${existingCount + PROBE_LABELS.length} 個階段`)
  check('階段很多時改整表橫滾而不是折行', many.overflow > 0, `橫滾 ${many.overflow}`)
} catch (err) {
  failures.push(`例外：${err.message}`)
} finally {
  for (const s of created) {
    await fetch(`${APP}api/contact-stages/${s.id}`, { method: 'DELETE' }).catch(() => {})
  }
  if (created.length) console.log(`已清除探针階段 ${created.length} 個`)
}

check('無 pageerror', errors.length === 0, errors.slice(0, 3).join(' | '))
await browser.close()
console.log(failures.length ? `\n✗ 未通過：${failures.join('、')}` : '\n✓ 全部通過')
process.exit(failures.length ? 1 : 0)
