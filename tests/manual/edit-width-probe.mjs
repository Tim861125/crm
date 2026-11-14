// inline 編輯欄位穩定性實測：點姓名／地點／聯絡進入編輯前後，比較各欄寬度
// （回归防護：table-layout: fixed + colgroup 若被改回 auto，切換會整表重排）
// 用法：先起 dev server（localhost:1138），再 bun tests/manual/edit-width-probe.mjs
import puppeteer from 'puppeteer-core'

const APP = 'http://localhost:1138/'
const sleep = ms => new Promise(r => setTimeout(r, ms))

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage']
})
const page = await browser.newPage()

const thWidths = () => page.evaluate(() =>
  [...document.querySelectorAll('.list-scroll .r-table thead th')]
    .map(th => +th.getBoundingClientRect().width.toFixed(1)))

let failed = 0

async function probe(label, clickSel) {
  const before = await thWidths()
  await page.click(clickSel)
  await sleep(250)
  const after = await thWidths()
  const diffs = before
    .map((w, i) => (Math.abs(after[i] - w) > 0.5 ? `#${i + 1}: ${w}→${after[i]}` : null))
    .filter(Boolean)
  if (diffs.length) failed++
  console.log(`${diffs.length ? '✗ 變形' : '  固定'}  ${label}${diffs.length ? '  ' + diffs.join(' | ') : ''}`)
  await page.keyboard.press('Escape') // 取消編輯，回到顯示態
  await sleep(250)
}

async function probeListPage() {
  await probe('姓名列', 'button[title="點擊編輯姓名"]')
  await probe('地點列', 'button[title="點擊編輯地點"]')
  await probe('聯絡列', 'button[title="點擊編輯聯絡方式"]')
}

// ── 1280px 寬螢幕 ──
await page.setViewport({ width: 1280, height: 900 })
await page.goto(APP, { waitUntil: 'networkidle0', timeout: 30000 })
await sleep(800)
await probeListPage()

// ── 手機窄螢幕 390px ──
await page.setViewport({ width: 390, height: 844 })
await page.goto(APP, { waitUntil: 'networkidle0', timeout: 30000 })
await sleep(800)
await probeListPage()

await browser.close()
process.exit(failed ? 1 : 0)
