// 驗證地點與聯絡方式「下拉內建新增／刪除」（creatable combobox）：
//   1. inline 編輯下拉底部常駐「＋ 新增」列；空白時 disabled，打字後可點
//   2. 點「＋ 新增」→ 選項落庫＋就地寫入該名單並結束編輯
//   3. 打字＋方向鍵＋Enter 走同一路徑
//   4. 選項右緣 × 刪除：下拉與 DB 都消失，且不會誤選取該項
//   5. 明細 modal 位置欄同行為（開 modal 同步最新選項）
//   6. 聯絡方式（contact_methods）走同一套：inline 建檔＋× 刪除＋預設 LINE／IG／FB
//   7. 全程無 pageerror
// 用法：先起 dev server（localhost:1138），再 bun tests/manual/location-creatable-verify.mjs
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

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage']
})
const page = await browser.newPage()
page.on('pageerror', e => errors.push(e.message))

const uid = Date.now() % 100000
const TMP1 = `TMP地點A${uid}`
const TMP2 = `TMP地點B${uid}`
const TMP_NAME = `TMP測試${uid}`

// DB 讀寫一律走頁面同源 fetch（避免另外管 cookie／baseURL）
// 清理採寬前綴：腳本中途崩潰也不會在開發 DB 累積 TMP 垃圾
const dbLocations = () => page.evaluate(() => fetch('/api/contact-locations').then(r => r.json()))
const purgeTmp = () => page.evaluate(async () => {
  const [locs, contacts, methods] = await Promise.all([
    fetch('/api/contact-locations').then(r => r.json()),
    fetch('/api/contacts').then(r => r.json()),
    fetch('/api/contact-methods').then(r => r.json())
  ])
  for (const hit of locs.filter(l => l.label.startsWith('TMP地點')))
    await fetch(`/api/contact-locations/${hit.id}`, { method: 'DELETE' })
  for (const c of contacts.filter(c => c.name.startsWith('TMP測試')))
    await fetch(`/api/contacts/${c.id}`, { method: 'DELETE' })
  for (const m of methods.filter(m => m.label.startsWith('TMP方式')))
    await fetch(`/api/contact-methods/${m.id}`, { method: 'DELETE' })
})

await page.goto(APP, { waitUntil: 'networkidle0', timeout: 30000 })
await sleep(800)
await purgeTmp()

// 建臨時名單（拿 id 錨定該列，測試不受其他資料排序影響）
const tmpId = await page.evaluate(async (name) => {
  const created = await (await fetch('/api/contacts', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name })
  })).json()
  return created.id
}, TMP_NAME)
await page.reload({ waitUntil: 'networkidle0' })
await sleep(900)

const rowSel = `tr[data-id="${tmpId}"]`
const cellBtnSel = `${rowSel} button[title="點擊編輯地點"]`
const comboSel = `${rowSel} input[aria-label="編輯地點"]`

// 開該列地點 inline 編輯並等下拉掛載
async function openCellEditor() {
  await page.click(cellBtnSel)
  await sleep(500)
}
const optionTexts = () => page.evaluate(() =>
  [...document.querySelectorAll('[role="option"]')].map(o => ({
    text: o.textContent.trim(),
    disabled: o.hasAttribute('data-disabled')
  }))
)
// 點底部「＋ 新增」列（以文字含「新增「」辨識）
const clickCreateRow = () => page.evaluate(() => {
  const row = [...document.querySelectorAll('[role="option"]')].find(o => o.textContent.includes('新增「'))
  if (!row) throw new Error('找不到新增列')
  row.click()
})
const waitCellText = async (want) => {
  for (let i = 0; i < 20; i++) {
    const t = await page.evaluate(s => document.querySelector(s)?.textContent.trim() ?? '', cellBtnSel)
    if (t === want) return true
    await sleep(200)
  }
  return false
}

// 1. 底部常駐新增列：空白輸入時 disabled（此列文字為提示語）
await openCellEditor()
{
  const opts = await optionTexts()
  const createRow = opts.at(-1)
  check('空白時底部有新增列且不可按', !!createRow && createRow.disabled && createRow.text.includes('新增'),
    `末列「${createRow?.text}」disabled=${createRow?.disabled}`)
  // 打字後可點，文字帶輸入內容
  await page.keyboard.type(TMP1)
  await sleep(300)
  const opts2 = await optionTexts()
  const row2 = opts2.at(-1)
  check('打字後新增列變為可按且帶名稱', !!row2 && !row2.disabled && row2.text === `＋新增「${TMP1}」`,
    `末列「${row2?.text}」disabled=${row2?.disabled}`)
  // 2. 點「＋ 新增」→ 落庫＋就地存入該名單並結束編輯
  await clickCreateRow()
  await sleep(700)
  const stored = (await dbLocations()).some(l => l.label === TMP1)
  check('點新增列：選項落庫', stored)
  const cellOk = await waitCellText(TMP1)
  const editingGone = await page.evaluate(s => !document.querySelector(s), comboSel)
  check('點新增列：就地寫入名單並結束編輯', cellOk && editingGone)
}

// 3. 方向鍵＋Enter 同一路徑（輸入 TMP2）
await openCellEditor()
{
  await page.keyboard.type(TMP2)
  await sleep(300)
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await sleep(700)
  const stored = (await dbLocations()).some(l => l.label === TMP2)
  const cellOk = await waitCellText(TMP2)
  check('方向鍵＋Enter 建立地點', stored && cellOk, `落庫=${stored} 儲存格=${cellOk}`)
}

// 4. × 刪除：下拉與 DB 都消失，且不會誤把該項選進輸入框
{
  await openCellEditor()
  const before = await page.evaluate((label) => {
    const btn = document.querySelector(`[aria-label="刪除選項「${label}」"]`)
    if (!btn) throw new Error('找不到刪除鈕')
    btn.click()
    return true
  }, TMP1)
  await sleep(600)
  const texts = (await optionTexts()).map(o => o.text)
  const goneFromMenu = !texts.some(t => t.includes(TMP1))
  const goneFromDb = !(await dbLocations()).some(l => l.label === TMP1)
  const term = await page.evaluate(s => document.querySelector(s)?.value ?? '', comboSel)
  check('× 刪除：下拉與 DB 同步消失', goneFromMenu && goneFromDb, `選單=${!goneFromMenu} DB=${!goneFromDb}`)
  check('× 刪除不會誤選該選項', before && term !== TMP1, `輸入框殘留「${term}」`)
  await page.keyboard.press('Escape') // 關下拉
  await page.keyboard.press('Escape') // 取消 inline 編輯
  await sleep(400)
}

// 5. 明細 modal：位置欄 combobox 可新增（TMP2 已由名單頁建好；這裡開下拉確認同步）
{
  await page.click(`${rowSel} button[title="note"]`)
  await sleep(900)
  const combo = '.r-dialog input[aria-label="編輯位置"]'
  await page.click(combo)
  await sleep(500)
  const texts = (await optionTexts()).map(o => o.text)
  check('明細位置下拉同步名單頁新增的選項', texts.some(t => t.includes(TMP2)), `下拉[${texts.join(',')}]`)
  // 在明細裡新增 TMP 第三個並確認寫表單（點新增列後落庫，位置欄同時回填）
  const TMP3 = `TMP地點C${uid}`
  await page.keyboard.down('Control')
  await page.keyboard.press('KeyA')
  await page.keyboard.up('Control')
  await page.keyboard.type(TMP3)
  await sleep(300)
  await clickCreateRow()
  await sleep(700)
  const stored = (await dbLocations()).some(l => l.label === TMP3)
  const val = await page.evaluate(s => document.querySelector(s)?.value ?? '', combo)
  check('明細內新增：落庫且回填位置欄', stored && val === TMP3, `落庫=${stored} 值「${val}」`)
  // 明細內 × 刪除 TMP3，但不清表單值（值屬名單資料，自由文字）
  await page.click(combo)
  await sleep(400)
  await page.evaluate(label => document.querySelector(`[aria-label="刪除選項「${label}」"]`)?.click(), TMP3)
  await sleep(500)
  const gone = !(await dbLocations()).some(l => l.label === TMP3)
  const val2 = await page.evaluate(s => document.querySelector(s)?.value ?? '', combo)
  check('明細內 × 刪除：選項消失但表單值保留', gone && val2 === TMP3, `消失=${gone} 值「${val2}」`)
  await page.keyboard.press('Escape') // 關下拉
  await sleep(300)
  // form.location 已被新增列改值 → dirty，關明細會彈 confirm；先掛 accept 再按 Esc
  page.once('dialog', d => d.accept())
  await page.keyboard.press('Escape') // 關明細
  await sleep(400)
}

// 6. 聯絡方式（contact_methods）：預設 LINE 在選單內；inline「＋ 新增」建檔＋就地存入；× 刪除
{
  const contactBtnSel = `${rowSel} button[title="點擊編輯聯絡方式"]`
  const dbMethods = () => page.evaluate(() => fetch('/api/contact-methods').then(r => r.json()))
  const clickContactEditor = async () => {
    await page.click(contactBtnSel)
    await sleep(500)
  }

  await clickContactEditor()
  const seededTexts = (await optionTexts()).map(o => o.text)
  check('聯絡方式預設 LINE／IG／FB 在選單內', ['LINE', 'IG', 'FB'].every(v => seededTexts.some(t => t.includes(v))), `下拉[${seededTexts.join(',')}]`)

  const TMC = `TMP方式D${uid}`
  await page.keyboard.type(TMC)
  await sleep(300)
  await clickCreateRow()
  await sleep(700)
  const storedM = (await dbMethods()).some(m => m.label === TMC)
  let cellOk = false
  for (let i = 0; i < 20; i++) {
    const t = await page.evaluate(s => document.querySelector(s)?.textContent.trim() ?? '', contactBtnSel)
    if (t === TMC) {
      cellOk = true
      break
    }
    await sleep(200)
  }
  check('聯絡方式 inline 新增：落庫＋就地存入', storedM && cellOk, `落庫=${storedM} 儲存格=${cellOk}`)

  await clickContactEditor()
  await page.evaluate(label => document.querySelector(`[aria-label="刪除選項「${label}」"]`)?.click(), TMC)
  await sleep(500)
  const goneM = !(await dbMethods()).some(m => m.label === TMC)
  check('聯絡方式 × 刪除：選項落庫消失', goneM)
  await page.keyboard.press('Escape') // 關下拉
  await page.keyboard.press('Escape') // 取消 inline 編輯
  await sleep(300)
}

// 清理：臨時名單與殘留 TMP 選項
await page.evaluate(async (id) => {
  await fetch(`/api/contacts/${id}`, { method: 'DELETE' })
}, tmpId)
await purgeTmp()

check('無 pageerror', errors.length === 0, errors.slice(0, 3).join(' | '))
await browser.close()

console.log(failures.length ? `\n✗ 失敗 ${failures.length} 項：${failures.join('、')}` : '\n全部通過')
process.exit(failures.length ? 1 : 0)
