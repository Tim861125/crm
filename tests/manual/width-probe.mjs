// 欄位寬度穩定性實測：對每個 input/textarea 記錄輸入前後的寬度（含父容器），找出會隨輸入變形的欄位
// 用法：先起 dev server（localhost:1138），再 bun tests/manual/width-probe.mjs
import puppeteer from 'puppeteer-core'

const APP = 'http://localhost:1138/'
const sleep = ms => new Promise(r => setTimeout(r, ms))

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage']
})
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 900 })
const errors = []
page.on('pageerror', e => errors.push(e.message.slice(0, 200)))

// 取得頁面上所有可輸入欄位的資訊（label 文字方便辨識）
const fieldInfo = `
  (function () {
    const els = [...document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea')];
    return els.map((el, i) => {
      const root = el.closest('label') ?? el.parentElement;
      const label = (root?.querySelector('span')?.textContent ?? el.placeholder ?? el.type ?? '').trim();
      return { i, tag: el.tagName, type: el.type, label,
        w: +el.getBoundingClientRect().width.toFixed(1),
        pw: +(el.parentElement?.getBoundingClientRect().width ?? 0).toFixed(1),
        value: el.value };
    });
  })
`

async function measure() {
  return page.evaluate(`(${fieldInfo})()`)
}

// 對第 idx 個欄位輸入一段長文字，再還原原值
async function typeAndMeasure(idx, text) {
  const before = await measure()
  const f = before[idx]
  await page.evaluate((i) => {
    const els = [...document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea')]
    els[i].focus()
  }, idx)
  await sleep(150)
  await page.keyboard.down('Meta'); await page.keyboard.press('KeyA'); await page.keyboard.up('Meta')
  await page.keyboard.type(f.type === 'date' ? '12152026' : text, { delay: 5 })
  await sleep(250)
  const after = await measure()
  const a = after[idx]
  // 還原原值（直接觸發 input 事件讓 v-model 更新）
  await page.evaluate((i, orig) => {
    const els = [...document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea')]
    const el = els[i]
    el.value = orig
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }, idx, f.value ?? '')
  await sleep(150)
  const restored = (await measure())[idx]
  return {
    label: f.label,
    field: `${f.w} → ${a.w}`,
    parent: `${f.pw} → ${a.pw}`,
    changed: Math.abs(a.w - f.w) > 0.5 || Math.abs(a.pw - f.pw) > 0.5,
    restored: Math.abs(restored.w - f.w) < 0.5
  }
}

async function probePage(name, openFn) {
  console.log(`\n══ ${name} ══`)
  if (openFn) await openFn()
  await sleep(600)
  const fields = await measure()
  for (const f of fields) {
    const r = await typeAndMeasure(f.i, '測試輸入很長的一段文字內容')
    console.log(`${r.changed ? '✗ 變形' : '  固定'}  [${r.label || f.type}] input ${r.field}｜父層 ${r.parent}`)
  }
}

// ── 總名單頁 ──
await page.goto(APP, { waitUntil: 'networkidle0', timeout: 30000 })
await sleep(800)
await probePage('總名單 /')

// 明細 modal
await probePage('明細 modal', async () => {
  await page.click('button[title="明細"]')
  await sleep(1000)
})
await page.keyboard.press('Escape')
await sleep(500)

// 管理階段／選項 modal（只測「新增」輸入框：列表 rename 會即時寫 DB，跳過）
await probePage('選項管理 modal（新增框）', async () => {
  for (const b of await page.$$('button')) {
    const t = await b.evaluate(el => el.textContent.trim())
    if (t.includes('管理階段／選項')) { await b.click(); break }
  }
  await sleep(800)
})
await page.keyboard.press('Escape')
await sleep(400)

// ── 每日任務頁 ──
await page.goto(APP + 'daily', { waitUntil: 'networkidle0', timeout: 30000 })
await sleep(900)
await probePage('每日任務 /daily')

// ── 手機窄螢幕 390px ──
await page.setViewport({ width: 390, height: 844 })
await page.goto(APP, { waitUntil: 'networkidle0', timeout: 30000 })
await sleep(800)
await probePage('【窄螢幕】總名單 /')
await probePage('【窄螢幕】明細 modal', async () => {
  await page.click('button[title="明細"]')
  await sleep(1000)
})

console.log('\n────── pageerror ──────')
for (const e of errors) console.log(e)
if (!errors.length) console.log('（無）')
await browser.close()
