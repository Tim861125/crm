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

// 傳 required 表示「這一步非跑不可」：找不到就大聲失敗中止，絕不靜默跳過放過壞掉的探查
async function clickVisible(sel, required) {
  const h = await visibleSelector(sel)
  if (!h) {
    if (required) {
      console.log(`X 找不到可見的${required}（選擇器 ${sel}）——探查中止，不得靜默跳過`)
      await browser.close()
      process.exit(1)
    }
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

// 按可見按鈕的可見文字（無障礙文字比 title 等屬性穩）；同 clickVisible，傳 required 就不准靜默跳過
async function clickText(text, required) {
  const el = await page.evaluateHandle(t =>
    [...document.querySelectorAll('button')]
      .find(b => b.textContent.includes(t) && b.getBoundingClientRect().width > 0), text)
  const h = el.asElement()
  if (!h) {
    if (required) {
      console.log(`X 找不到可見的「${text}」按鈕——探查中止，不得靜默跳過`)
      await browser.close()
      process.exit(1)
    }
    console.log(`（無可見「${text}」按鈕，跳過）`)
    return false
  }
  await h.click()
  await sleep(900)
  return true
}

await visit('', 'index')
await visit('daily', 'daily')
await visit('plans', 'plans')

// 明細 modal（總名單第一列 Info 鈕）
// 鈕的無障礙名稱是「Info：開啟「X」明細」（WCAG 2.5.3 Label in Name 要求以可見文字 Info 開頭），
// 舊選擇器 aria-label^="開啟" 已永不命中；改以可及性文字「明細」做包含比對，不怕前綴再變動
await page.goto(APP, { waitUntil: 'networkidle0', timeout: 60000 })
await sleep(1200)
await clickVisible('button[aria-label*="明細"]', '明細 modal 開啟鈕（Info）')
await report('index_明細modal')
await shot('index_明細modal')
// 階段管理 dialog：窄屏下進度欄表頭齒輪（col-hide-sm）根本不可見，舊選擇器 title="管理進度階段"
// 在手機寬度永遠落空；手機版唯一入口是明細列尾新增的「管理進度階段」鈕——改點它，
// 測的才是手機用戶真正摸得到的那條路徑
await clickText('管理進度階段', '明細列尾「管理進度階段」鈕')
await report('index_階段管理modal')
await shot('index_階段管理modal')
await page.keyboard.press('Escape') // 收階段管理 dialog
await sleep(500)
await page.keyboard.press('Escape') // 收明細 modal
await sleep(500)
// 計畫編輯 dialog
await page.goto(APP + 'plans', { waitUntil: 'networkidle0', timeout: 60000 })
await sleep(1200)
await clickText('擬新計畫', '「擬新計畫」鈕')
await report('plans_編輯modal')
await shot('plans_編輯modal')
await page.keyboard.press('Escape')
await sleep(500)

console.log('\n------ pageerror ------')
for (const e of errors) console.log(e)
if (!errors.length) console.log('（無）')
await browser.close()
