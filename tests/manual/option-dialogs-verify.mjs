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
await openDialog('工具列钮', '管理人名選項', async () => {
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

check('無 pageerror', errors.length === 0, errors.slice(0, 3).join(' | '))
await browser.close()

console.log(failures.length ? `\n✗ 失敗 ${failures.length} 項：${failures.join('、')}` : '\n全部通過')
process.exit(failures.length ? 1 : 0)
