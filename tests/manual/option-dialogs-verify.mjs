// 驗證兩個管理 dialog 入口與地點選項同步：
//   1. 進度欄標題鈕 →「管理進度階段」dialog（Esc 可關）
//   2. 地點欄標題鈕 →「管理地點選項」dialog（Esc 可關）
//   3. 管理 dialog 新增地點後，明細位置下拉看得到（refresh-on-open）
//   4. 全程無 pageerror
// 用法：先起 dev server（localhost:1138），再 bun tests/manual/option-dialogs-verify.mjs
import puppeteer from 'puppeteer-core'

const APP = 'http://localhost:1138/'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const errors = []
const failures = []

function check(name, ok, note = '') {
  console.log(`${ok ? '✓' : '✗'} ${name}${note ? `（${note}）` : ''}`)
  if (!ok) failures.push(name)
}

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage']
})
const page = await browser.newPage()
page.on('pageerror', e => errors.push(e.message))
await page.goto(APP, { waitUntil: 'networkidle0', timeout: 30000 })
await sleep(800)

// 開 dialog → 確認唯一開啟的 <dialog> 標題 → Esc 關閉
async function openDialog(name, expectedTitle, openFn) {
  let ok = false
  let note = ''
  try {
    await openFn()
    await sleep(600)
    const state = await page.evaluate(() => {
      const open = [...document.querySelectorAll('dialog.r-dialog')].filter(d => d.open)
      return { count: open.length, title: open[0]?.querySelector('h2')?.textContent?.trim() ?? '' }
    })
    ok = state.count === 1 && state.title === expectedTitle
    if (!ok) note = `開啟 ${state.count} 個，標題「${state.title}」`
    await page.keyboard.press('Escape')
    await sleep(400)
    const closed = await page.evaluate(() => ![...document.querySelectorAll('dialog.r-dialog')].some(d => d.open))
    if (ok && !closed) {
      ok = false
      note = 'Esc 後仍有開啟的 dialog'
    }
  } catch (err) {
    note = String(err).slice(0, 80)
  }
  check(`${name} →「${expectedTitle}」`, ok, note)
}

await openDialog('進度欄標題鈕', '管理進度階段', () => page.click('button[title="點擊管理進度階段"]'))
await openDialog('地點欄標題鈕', '管理地點選項', () => page.click('button[title="點擊管理地點選項"]'))

// 在開啟的 dialog 內填新增框並按 Enter 送出
async function fillDialogInput(aria, value) {
  await page.evaluate((a, v) => {
    const input = [...document.querySelectorAll('dialog[open] input')].find(i => i.getAttribute('aria-label') === a)
    if (!input) throw new Error(`找不到輸入框 ${a}`)
    input.value = v
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  }, aria, value)
  await sleep(600)
}

// 讀明細 modal 內指定欄位（label span 文字，如「誰的朋友」）select 的全部 option 文字
async function detailSelectOptions(labelText) {
  await page.click('button[aria-label$="的明細"]')
  await sleep(800)
  const opts = await page.evaluate((text) => {
    const label = [...document.querySelectorAll('dialog[open] label')]
      .find(l => l.querySelector('span')?.textContent.trim() === text)
    if (!label) throw new Error(`找不到欄位「${text}」`)
    return [...label.querySelectorAll('option')].map(o => o.textContent.trim())
  }, labelText)
  await page.keyboard.press('Escape')
  await sleep(400)
  return opts
}

// 3. 管理 dialog 新增地點後，明細下拉應看得到（refresh-on-open）
{
  const tmpLoc = `TMP地點${Date.now() % 100000}`
  let note = ''
  try {
    await page.click('button[title="點擊管理地點選項"]')
    await sleep(600)
    await fillDialogInput('新的地點', tmpLoc)
    await page.keyboard.press('Escape')
    await sleep(400)
    const locOpts = await detailSelectOptions('位置')
    const okLoc = locOpts.includes(tmpLoc)
    if (!okLoc) note = `位置下拉[${locOpts.join(',')}]`
    check('明細位置下拉同步新增選項', okLoc, note)
  } catch (err) {
    check('明細位置下拉同步新增選項', false, String(err).slice(0, 80))
  }
  // 清掉臨時選項
  await page.evaluate(async (names) => {
    const list = await (await fetch('/api/contact-locations')).json()
    for (const hit of list.filter(x => names.includes(x.label)))
      await fetch(`/api/contact-locations/${hit.id}`, { method: 'DELETE' })
  }, [tmpLoc])
  await sleep(300)
}

check('無 pageerror', errors.length === 0, errors.slice(0, 3).join(' | '))
await browser.close()

console.log(failures.length ? `\n✗ 失敗 ${failures.length} 項：${failures.join('、')}` : '\n全部通過')
process.exit(failures.length ? 1 : 0)
