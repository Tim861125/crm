// 驗證「目標」欄位（總名單列表＋note modal）：
//   1. 總名單表頭有「目標」、已無「Info」欄
//   2. 目標儲存格 inline 編輯：下拉選項 seeded 破題／群星計畫／打籃球，點選後存庫並顯示
//   3. note modal 有「目標」下拉（值會帶入），Info textarea 仍在 modal 中
//   4. 全程無 pageerror
// 用法：先起 dev server（localhost:1138），再 bun tests/manual/goal-column-verify.mjs
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

// 測資：直接開一筆帶姓名的名單，測完刪掉，不動既有資料
const created = await (await fetch(`${APP}api/contacts`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ name: '目標探針' })
})).json()

try {
  await page.goto(APP, { waitUntil: 'networkidle0', timeout: 30000 })
  await sleep(800)

  // 1) 表頭：有目標、無 Info
  const ths = await page.$$eval('.list-scroll thead th', els => els.map(e => e.textContent.trim()))
  check('表頭含「目標」', ths.includes('目標'), ths.join('/'))
  check('表頭已無「Info」', !ths.includes('Info'))

  // 2) inline 編輯：開該列目標儲存格 → 下拉出 seeded 選項 → 點「破題」→ blur 存庫
  const target = `goal-${created.id}`
  await page.click(`button[data-edit-target="${target}"]`)
  await sleep(500)
  const panelItems = await page.$$eval('.r-pop-menu__item', els => els.map(e => e.textContent.replace(/[＋×]/g, '').trim()))
  check(
    '編輯下拉列出 seeded 選項',
    ['破題', '群星計畫', '打籃球'].every(l => panelItems.includes(l)),
    panelItems.join('/')
  )
  const items = await page.$$('.r-pop-menu__item')
  let clicked = false
  for (const el of items) {
    const text = (await el.evaluate(n => n.textContent)).replace(/[＋×]/g, '').trim()
    if (text !== '破題') continue
    await el.click()
    clicked = true
    break
  }
  check('點選「破題」', clicked)
  await sleep(400) // 越過 RCombobox 選取後的 blur 抑制窗口，下一次 blur 才會放行
  await page.click('h1') // 真實點擊别處 → input blur → commitEdit
  await sleep(600)
  const cellText = await page.$eval(`button[data-edit-target="${target}"]`, el => el.textContent.trim())
  check('儲存後儲存格顯示「破題」', cellText === '破題', cellText)

  // 後端確存有值
  const list = await (await fetch(`${APP}api/contacts`)).json()
  check('API 層 goal 已存入', list.find(c => c.id === created.id)?.goal === '破題')

  // 3) note modal：有「目標」下拉且帶入現值；Info textarea 仍在
  // Info 鈕的無障礙名稱現為「Info：開啟「X」明細」（WCAG 2.5.3 要含可見文字）。
  // 鎖「Info：開啟「」前綴：只寫姓名會同時命中「編輯姓名「X」」等鈕而點錯
  await page.click(`button[aria-label*="Info：開啟「目標探針」"]`)
  await sleep(800)
  const modalState = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]')
    if (!dialog) return { open: false }
    const labels = [...dialog.querySelectorAll('.detail-form label > span')].map(s => s.textContent.trim())
    const goalInput = [...dialog.querySelectorAll('.detail-form label')]
      .find(l => l.querySelector('span')?.textContent.trim() === '目標')
      ?.querySelector('input')
    return {
      open: true,
      labels,
      goalValue: goalInput?.value ?? null,
      // 欄位標籤早在 main 上就從「Info」改名「Note」（ContactDetailModal 的 .detail-form label），
      // 舊斷言認「Info」是腳本過期，不是功能不見：這裡要驗證的是那個 note 欄位仍是 textarea
      hasInfoTextarea: [...dialog.querySelectorAll('.detail-form label')]
        .some(l => l.querySelector('span')?.textContent.trim() === 'Note' && l.querySelector('textarea'))
    }
  })
  check('modal 欄位含「目標」', modalState.open && modalState.labels.includes('目標'), modalState.labels?.join('/'))
  check('modal 目標下拉帶入現值', modalState.goalValue === '破題', String(modalState.goalValue))
  check('modal 仍有 Info textarea', modalState.hasInfoTextarea)
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
