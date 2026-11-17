// 驗證管理 dialog 入口與地點欄位現況：
//   1. 進度欄標題鈕 →「管理進度階段」dialog（Esc 可關）
//   2. 地點欄標題已無管理入口（地點增刪改在編輯下拉內，行為見 location-creatable-verify.mjs）
//   3. 全程無 pageerror
// 用法：先起 dev server（localhost:1138），再 bun tests/manual/option-dialogs-verify.mjs
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
await page.goto(APP, { waitUntil: 'networkidle0', timeout: 30000 })
await sleep(800)

// 開 dialog → 確認唯一開啟的 [role=dialog]（reka Dialog：掛載＝開啟）標題 → Esc 關閉
async function openDialog(name, expectedTitle, openFn) {
  let ok = false
  let note = ''
  try {
    await openFn()
    await sleep(600)
    const state = await page.evaluate(() => {
      const open = [...document.querySelectorAll('[role="dialog"].r-dialog')]
      return { count: open.length, title: open[0]?.querySelector('h2')?.textContent?.trim() ?? '' }
    })
    ok = state.count === 1 && state.title === expectedTitle
    if (!ok) note = `開啟 ${state.count} 個，標題「${state.title}」`
    await page.keyboard.press('Escape')
    await sleep(400)
    const closed = await page.evaluate(() => !document.querySelector('[role="dialog"].r-dialog'))
    if (ok && !closed) {
      ok = false
      note = 'Esc 後仍有開啟的 dialog'
    }
  } catch (err) {
    note = String(err).slice(0, 80)
  }
  check(`${name} →「${expectedTitle}」`, ok, note)
}

await openDialog('進度欄齒輪鈕', '管理進度階段', () => page.click('button[title="管理進度階段"]'))

// 2. 地點欄標題：應為純 <th> 文字（無管理鈕）
{
  const hasBtn = await page.evaluate(() => !!document.querySelector('button[title="點擊管理地點選項"]'))
  const plain = await page.evaluate(() =>
    [...document.querySelectorAll('.r-table th')].some(th => th.textContent.trim() === '地點' && !th.querySelector('button'))
  )
  check('地點欄標題已無管理入口', !hasBtn && plain, !hasBtn && plain ? '' : (hasBtn ? '管理鈕仍在' : '找不到純文字「地點」欄頭'))
}

check('無 pageerror', errors.length === 0, errors.slice(0, 3).join(' | '))
await browser.close()

console.log(failures.length ? `\n✗ 失敗 ${failures.length} 項：${failures.join('、')}` : '\n全部通過')
process.exit(failures.length ? 1 : 0)
