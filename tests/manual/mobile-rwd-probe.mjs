// 手機版 RWD 探查：窄螢幕（預設 375px）下逐頁量橫向溢位＋截圖
// 用法：先起 dev server（localhost:1138），再 bun tests/manual/mobile-rwd-probe.mjs [width]
// 可覆寫：CHROME_PATH（Chrome 位置）、SHOT_DIR（截圖目錄）
import { existsSync, mkdirSync } from 'node:fs'
import puppeteer from 'puppeteer-core'

const APP = 'http://localhost:1138/'
const W = Number(process.argv[2] ?? 375)
const OUT = process.env.SHOT_DIR ?? '/tmp/opencode/shots'
const CHROME = process.env.CHROME_PATH
  ?? ['/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(existsSync)
  ?? 'chrome'
mkdirSync(OUT, { recursive: true })
const sleep = ms => new Promise(r => setTimeout(r, ms))

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage']
})
const page = await browser.newPage()
await page.setViewport({ width: W, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const errors = []
page.on('pageerror', e => errors.push(e.message.slice(0, 200)))

function probeFn() {
  const vw = document.documentElement.clientWidth
  const wide = []
  for (const el of document.querySelectorAll('body *')) {
    if (el.tagName === 'COL' || el.tagName === 'COLGROUP') continue
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    const style = getComputedStyle(el)
    if (style.position === 'fixed') continue
    // 在可橫滾容器（overflow-x: auto/scroll/hidden）內的元素：凸出視窗屬預期行為，由容器自行消化
    let clipped = false
    for (let p = el.parentElement; p; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX
      if (ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip') {
        clipped = true
        break
      }
    }
    if (clipped) continue
    if (r.right > vw + 1 || r.left < -1) wide.push(el)
  }
  // 只報「最內層」溢位元素（子層沒有其他溢位者）＝根因所在
  const overflowers = wide.filter(el => !wide.some(o => o !== el && el.contains(o)))
  return {
    docScrollW: document.documentElement.scrollWidth,
    vw,
    pageHasHScroll: document.documentElement.scrollWidth > vw + 1,
    overflowers: overflowers.slice(0, 14).map((el) => {
      const r = el.getBoundingClientRect()
      const cls = (typeof el.className === 'string' ? el.className : (el.className && el.className.baseVal) || '').slice(0, 60)
      return {
        tag: el.tagName.toLowerCase(),
        cls,
        text: (el.textContent || '').trim().slice(0, 24),
        left: Math.round(r.left),
        right: Math.round(r.right),
        w: Math.round(r.width)
      }
    })
  }
}

async function report(name) {
  const r = await page.evaluate(probeFn)
  console.log(`\n== ${name} == vw=${r.vw} docScrollW=${r.docScrollW} ${r.pageHasHScroll ? 'X 整頁橫滾' : 'OK 無整頁橫滾'}`)
  for (const o of r.overflowers)
    console.log(`  溢出 <${o.tag} class="${o.cls}"> "${o.text}" left=${o.left} right=${o.right} w=${o.w}`)
  if (!r.overflowers.length && r.pageHasHScroll)
    console.log('  （溢位來自 fixed 元素或 body 本身，見 docScrollW）')
  return r
}

async function shot(name) {
  await page.screenshot({ path: `${OUT}/${W}px-${name}.png`, fullPage: true })
}

// 只回傳「窄屏下實際可見」的第一個符合按鈕（display:none 的 hidden 元素 boundingBox 為 0，puppeteer 點擊會直接 throw）
async function visibleSelector(sel) {
  const h = await page.evaluateHandle(s =>
    [...document.querySelectorAll(s)].find(b => b.getBoundingClientRect().width > 0), sel)
  return h.asElement()
}

async function clickVisible(sel) {
  const h = await visibleSelector(sel)
  if (!h) {
    console.log(`（無可見 ${sel}，跳過）`)
    return false
  }
  await h.click()
  await sleep(900)
  return true
}

async function visit(url, name) {
  await page.goto(APP + url, { waitUntil: 'networkidle0', timeout: 60000 })
  await sleep(1200)
  await report(name)
  await shot(name)
}

async function clickText(text) {
  const el = await page.evaluateHandle(t => [...document.querySelectorAll('button')].find(b => b.textContent.includes(t)), text)
  const h = el.asElement()
  if (!h) return false
  await h.click()
  await sleep(900)
  return true
}

await visit('', 'index')
await visit('daily', 'daily')
await visit('plans', 'plans')

// 明細 modal（總名單第一列 Info 鈕）
await page.goto(APP, { waitUntil: 'networkidle0', timeout: 60000 })
await sleep(1200)
if (await clickVisible('button[aria-label^="開啟"]')) {
  await report('index_明細modal')
  await shot('index_明細modal')
  await page.keyboard.press('Escape')
  await sleep(500)
}
// 階段管理 dialog（手機版進度欄隱藏 → 齒輪鈕不存在於可見列，clickVisible 會跳過）
if (await clickVisible('button[title="管理進度階段"]')) {
  await report('index_階段管理modal')
  await shot('index_階段管理modal')
  await page.keyboard.press('Escape')
  await sleep(500)
}
// 計畫編輯 dialog
await page.goto(APP + 'plans', { waitUntil: 'networkidle0', timeout: 60000 })
await sleep(1200)
if (await clickText('擬新計畫')) {
  await report('plans_編輯modal')
  await shot('plans_編輯modal')
  await page.keyboard.press('Escape')
  await sleep(500)
}

console.log('\n------ pageerror ------')
for (const e of errors) console.log(e)
if (!errors.length) console.log('（無）')
await browser.close()
