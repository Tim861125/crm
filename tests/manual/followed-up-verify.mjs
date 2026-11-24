// 驗證「已跟進」checkbox（總名單動作欄 note 鈕左邊新欄位）：
//   1. 表頭有「已跟進」欄，該列有 checkbox
//   2. 打勾 → 後端 lastFollowUp＝今天，並多一筆今天的跟進紀錄（內容「已跟進」）
//   3. note modal 的跟進紀錄時間軸看得到那一筆（日期＋已跟進）
//   4. 取消勾選（confirm 確定）→ 今天的紀錄被刪掉、checkbox 變回未勾
//   5. 全程無 pageerror
// 用法：先起 dev server（localhost:1138），再 bun tests/manual/followed-up-verify.mjs
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

// 與前端 todayStr() 同款：本地時區的 YYYY-MM-DD
const now = new Date()
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage']
})
const page = await browser.newPage()
page.on('pageerror', e => errors.push(e.message))
page.on('dialog', d => d.accept()) // 取消勾選的 confirm 一律按「確定」

// 測資：新建立一位（不帶跟進日），測完刪掉，不動既有資料
const created = await (await fetch(`${APP}api/contacts`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ name: '已跟進探針' })
})).json()

const boxSel = `tr[data-id="${created.id}"] .cell-check [role="checkbox"]`
const boxState = () => page.$eval(boxSel, el => el.getAttribute('data-state'))
const getContact = async () => (await (await fetch(`${APP}api/contacts`)).json()).find(c => c.id === created.id)
const getLogs = async () => (await (await fetch(`${APP}api/contacts/${created.id}/logs`)).json())

try {
  await page.goto(APP, { waitUntil: 'networkidle0', timeout: 30000 })
  await sleep(800)

  // 1) 表頭與 checkbox 存在，位置在「動作」欄（note 鈕那欄）左邊
  const ths = await page.$$eval('.list-scroll thead th', els => els.map(e => e.textContent.trim()))
  check('表頭含「已跟進」', ths.includes('已跟進'), ths.join('/'))
  const idx = ths.indexOf('已跟進')
  check('「已跟進」緊鄰最後一欄（動作欄左邊）', idx === ths.length - 2)
  check('該列有 checkbox', (await page.$$(boxSel)).length === 1)
  check('初始未勾', (await boxState()) === 'unchecked', await boxState())

  // 2) 打勾 → 記一筆今天的跟進
  await page.click(boxSel)
  await sleep(900)
  check('打勾後 checkbox 變已勾', (await boxState()) === 'checked', await boxState())
  const afterCheck = await getContact()
  check('lastFollowUp＝今天', afterCheck?.lastFollowUp === today, String(afterCheck?.lastFollowUp))
  const logsAfterCheck = await getLogs()
  const todays = logsAfterCheck.filter(l => l.date === today)
  check('多了一筆今天的跟進紀錄', todays.length === 1 && todays[0].content === '已跟進', JSON.stringify(todays))

  // 3) note modal 時間軸看得到那一筆
  // Info 鈕的無障礙名稱現為「Info：開啟「X」明細」（WCAG 2.5.3 要含可見文字）。
  // 必須鎖「Info：開啟「」前綴：只寫姓名會同時命中「編輯姓名「X」」「刪除「X」」等鈕，page.click 會點到編輯姓名
  await page.click(`button[aria-label*="Info：開啟「已跟進探針」"]`)
  await sleep(800)
  const modal = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]')
    const items = [...(dialog?.querySelectorAll('.log-item') ?? [])]
      .map(li => `${li.querySelector('.r-badge')?.textContent.trim()}|${li.querySelector('.log-content')?.textContent.trim()}`)
    return { open: !!dialog, items }
  })
  check(
    'note 時間軸有「今天｜已跟進」一筆',
    modal.open && modal.items.some(t => t.startsWith(today) && t.endsWith('已跟進')),
    modal.items.join(' / ')
  )
  await page.keyboard.press('Escape')
  await sleep(500)

  // 4) 取消勾選 → 先跑 confirm（ContactList.toggleFollowedUp 的「取消今日跟進」確認框），
  //    要按確認鈕「取消跟進」才會真的刪今天的紀錄；只點 checkbox 會停在確認框上，永遠不會取消
  await page.click(boxSel)
  await sleep(600)
  const confirmed = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.r-confirm button')].find(b => b.textContent.trim() === '取消跟進')
    if (btn) btn.click()
    return !!btn
  })
  check('取消勾選先彈出確認框且找到「取消跟進」鈕', confirmed)
  await sleep(900)
  check('取消後 checkbox 變未勾', (await boxState()) === 'unchecked', await boxState())
  check('今天的紀錄已刪除', (await getLogs()).filter(l => l.date === today).length === 0)
  check('lastFollowUp 回到 null', (await getContact())?.lastFollowUp === null)

  check('刪除名單後 checkbox 消失', await (async () => {
    await fetch(`${APP}api/contacts/${created.id}`, { method: 'DELETE' })
    await page.reload({ waitUntil: 'networkidle0' })
    await sleep(700)
    return (await page.$$(boxSel)).length === 0
  })())
} catch (err) {
  // 中途異常要報出來，不能讓 finally 的 exit 吞掉（否則會誤報全過）
  check('探針流程完成', false, String(err instanceof Error ? err.message : err))
} finally {
  await fetch(`${APP}api/contacts/${created.id}`, { method: 'DELETE' })
  check('無 pageerror', errors.length === 0, errors.join(' | '))
  await browser.close()
  console.log(failures.length ? `✗ 失敗 ${failures.length} 項：${failures.join('、')}` : '✓ 全部通過')
  process.exit(failures.length ? 1 : 0)
}
