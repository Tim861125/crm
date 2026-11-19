// 佐證：點開 note modal 時，「位置」下拉是否被預設展開＋焦點落在哪
// 用法：node /tmp/opencode/note-modal-location-probe.mjs [--list]（--list 改測名單頁地點 inline 編輯）
import puppeteer from 'puppeteer-core'

const APP = 'http://localhost:1138/'
const mode = process.argv.includes('--list') ? 'list' : 'modal'

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage']
})
const page = await browser.newPage()
const errors = []
page.on('pageerror', e => errors.push(e.message))

// 等 dev server 就緒
let ready = false
for (let i = 0; i < 60 && !ready; i++) {
  try {
    await page.goto(APP, { waitUntil: 'networkidle0', timeout: 10000 })
    ready = true
  } catch {
    await new Promise(r => setTimeout(r, 2000))
  }
}
if (!ready) {
  console.log('dev server 沒起來')
  await browser.close()
  process.exit(1)
}
await new Promise(r => setTimeout(r, 800))

const probe = () => page.evaluate(() => {
  const ae = document.activeElement
  const focusOn = ae ? `${ae.tagName}${ae.className ? '.' + String(ae.className).split(' ')[0] : ''}` : 'none'
  // 展開中的 combobox 面板（reka 收合時不掛 content；展開時 role=listbox 可見）
  const lists = [...document.querySelectorAll('[role="listbox"]')].filter(el => el.offsetParent !== null || el.getClientRects().length)
  const focusCombo = ae?.closest('[data-reka-combobox-root], .r-combo__anchor') ? true : false
  return { focusOn, focusInCombo: focusCombo, openPanels: lists.length, openOptions: lists.reduce((n, l) => n + l.querySelectorAll('[role="option"]').length, 0) }
})

if (mode === 'modal') {
  await page.click('button[title="note"]')
  await new Promise(r => setTimeout(r, 900))
  console.log('[開 note 後]', await probe())
  // 使用者主動點「位置」欄，仍應展開（不可回歸）
  const box = await page.evaluate(() => {
    const label = [...document.querySelectorAll('.r-dialog label')].find(l => l.querySelector('span')?.textContent.trim() === '位置')
    const t = label?.querySelector('input')
    if (!t) throw new Error('找不到「位置」欄')
    const r = t.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })
  await page.mouse.click(box.x, box.y)
  await new Promise(r => setTimeout(r, 600))
  console.log('[手動點位置後]', await probe())
} else {
  // 名單頁：點地點儲存格進入 inline 編輯，下拉應展開（回歸驗證）
  const btn = await page.$('button.cell-edit[data-edit-target^="location-"]')
  if (!btn) {
    console.log('找不到地点 inline 編輯鈕')
    await browser.close()
    process.exit(1)
  }
  await btn.click()
  await new Promise(r => setTimeout(r, 700))
  console.log('[名單 inline 編輯地點]', await probe())
}
console.log('pageerrors:', errors.length ? errors : '（無）')
await browser.close()
