// 驗證三個管理 dialog 入口與進度篩選鈕：
//   1. 進度欄標題鈕 →「管理進度階段」dialog（Esc 可關）
//   2. 地點欄標題鈕 →「管理地點選項」dialog（Esc 可關）
//   3. 工具列「管理人名選項」鈕 →「管理人名選項」dialog（Esc 可關）
//   4. 「循環進度篩選」鈕：有階段時 aria-label 循環生效；無階段時可點、不崩潰
//   5. 全程無 pageerror
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

const stageCount = await page.evaluate(async () => (await (await fetch('/api/contact-stages')).json()).length)

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
await openDialog('工具列鈕', '管理人名選項', async () => {
  for (const b of await page.$$('button')) {
    const t = await b.evaluate(el => el.textContent.trim())
    if (t === '管理人名選項') {
      await b.click()
      return
    }
  }
  throw new Error('找不到「管理人名選項」按鈕')
})

// 進度篩選鈕循環：有階段 → aria-label 改變並含階段名；無階段 → 可點且標籤維持
{
  let ok = false
  let note
  try {
    const sel = 'button[title="循環進度篩選"]'
    const before = await page.$eval(sel, el => el.getAttribute('aria-label') ?? '')
    await page.click(sel)
    await sleep(400)
    const after = await page.$eval(sel, el => el.getAttribute('aria-label') ?? '')
    if (stageCount > 0) {
      ok = after !== before && after.includes('進度篩選：')
      if (!ok) note = `before「${before}」after「${after}」`
      else note = `階段 ${stageCount} 個`
    } else {
      ok = after === before // 空清單循環 pool 只剩 all：不崩潰、標籤不變即為通過
      note = '無階段，維持全部'
    }
  } catch (err) {
    note = String(err).slice(0, 80)
  }
  check('循環進度篩選鈕', ok, note)
}

// 依文字點按鈕（工具列鈕沒有 title 屬性）
async function clickByText(text) {
  for (const b of await page.$$('button')) {
    const t = await b.evaluate(el => el.textContent.trim())
    if (t === text) {
      await b.click()
      return true
    }
  }
  return false
}

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

// 5. 管理 dialog 新增人名／地點後，明細下拉應看得到（refresh-on-open）
{
  const stamp = Date.now() % 100000
  const tmpOpt = `TMP人名${stamp}`
  const tmpLoc = `TMP地點${stamp}`
  let note = ''
  try {
    await clickByText('管理人名選項')
    await sleep(600)
    await fillDialogInput('新的人名', tmpOpt)
    await page.keyboard.press('Escape')
    await sleep(400)
    await page.click('button[title="點擊管理地點選項"]')
    await sleep(600)
    await fillDialogInput('新的地點', tmpLoc)
    await page.keyboard.press('Escape')
    await sleep(400)
    const personOpts = await detailSelectOptions('誰的朋友')
    const locOpts = await detailSelectOptions('位置')
    const okOpt = personOpts.includes(tmpOpt)
    const okLoc = locOpts.includes(tmpLoc)
    if (!okOpt || !okLoc) note = `人名下拉[${personOpts.join(',')}] 位置下拉[${locOpts.join(',')}]`
    check('明細人名下拉同步新增選項', okOpt, note)
    check('明細位置下拉同步新增選項', okLoc, note)
  } catch (err) {
    check('明細人名下拉同步新增選項', false, String(err).slice(0, 80))
    check('明細位置下拉同步新增選項', false, '')
  }
  // 清掉臨時選項
  await page.evaluate(async (names) => {
    for (const path of ['contact-options', 'contact-locations']) {
      const list = await (await fetch(`/api/${path}`)).json()
      for (const hit of list.filter(x => names.includes(x.label)))
        await fetch(`/api/${path}/${hit.id}`, { method: 'DELETE' })
    }
  }, [tmpOpt, tmpLoc])
  await sleep(300)
}

// 6. 篩選作用中的地點被刪掉後，篩選還位「全部地點」（榜單不再空转）
{
  const tmpLoc = `TMP篩選${Date.now() % 100000}`
  let ok = false, note = ''
  try {
    await page.evaluate(async (label) => {
      await fetch('/api/contact-locations', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ label }) })
    }, tmpLoc)
    await page.reload({ waitUntil: 'networkidle0' })
    await sleep(700)
    await page.evaluate((label) => {
      const sel = document.querySelector('select[aria-label="依地點篩選"]')
      sel.value = label
      sel.dispatchEvent(new Event('change', { bubbles: true }))
    }, tmpLoc)
    await sleep(400)
    await page.click('button[title="點擊管理地點選項"]')
    await sleep(500)
    await page.evaluate((name) => {
      const btn = [...document.querySelectorAll('dialog[open] button')].find(b => b.getAttribute('aria-label') === `刪除地點「${name}」`)
      if (!btn) throw new Error(`找不到刪除鈕「${name}」`)
      btn.click()
    }, tmpLoc)
    await sleep(900)
    await page.keyboard.press('Escape')
    await sleep(300)
    const val = await page.$eval('select[aria-label="依地點篩選"]', s => s.value)
    const rows = await page.evaluate(() => document.querySelectorAll('tbody tr[data-id]').length)
    ok = val === 'all' && rows > 0
    if (!ok) note = `select 值「${val}」、列數 ${rows}`
  } catch (err) {
    note = String(err).slice(0, 80)
  }
  check('刪除篩選中的作用中地點後篩選還位全部', ok, note)
}

// 7. 「進度」管理鈕只管開 dialog，不碰篩選狀態
{
  let ok = false, note = ''
  try {
    const sel = 'button[title="循環進度篩選"]'
    const before = await page.$eval(sel, el => el.getAttribute('aria-label') ?? '')
    await page.click('button[title="點擊管理進度階段"]')
    await sleep(500)
    await page.keyboard.press('Escape')
    await sleep(300)
    const after = await page.$eval(sel, el => el.getAttribute('aria-label') ?? '')
    ok = before === after
    if (!ok) note = `before「${before}」after「${after}」`
  } catch (err) {
    note = String(err).slice(0, 80)
  }
  check('開閉進度管理 dialog 不影響進度篩選', ok, note)
}

check('無 pageerror', errors.length === 0, errors.slice(0, 3).join(' | '))
await browser.close()

console.log(failures.length ? `\n✗ 失敗 ${failures.length} 項：${failures.join('、')}` : '\n全部通過')
process.exit(failures.length ? 1 : 0)
