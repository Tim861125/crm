// 手繪日期輸入（RDateInput）實渲驗證：/plans 編輯器、/daily worksheet cell、/ 明细 modal
// 用法：bun run dev 後 `node tests/manual/date-sketch-verify.mjs`（截圖輸出到 /tmp/opencode/）
import puppeteer from 'puppeteer-core'

const APP = 'http://localhost:1138'
const OUT = process.env.OUT_DIR ?? '/tmp/opencode'
const sleep = ms => new Promise(r => setTimeout(r, ms))

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage']
})
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 900 })
const errors = []
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error')
    errors.push(`console: ${m.text()}`)
})

// 檢查一組 .r-date 欄位：原生 date input＋手繪框已畫出＋圖示存在＋空值淡色 class
async function inspectDates(scope) {
  return page.evaluate((s) => {
    return [...document.querySelectorAll(`${s} .r-date`)].map((el) => {
      const frame = el.closest('.r-date__frame')
      const cs = getComputedStyle(el)
      const icon = frame?.querySelector('.r-date__pick')
      return {
        scope: s,
        type: el.type,
        cell: el.classList.contains('r-date--cell'),
        empty: el.classList.contains('is-empty'),
        paddingRight: cs.paddingRight,
        fontFamily: cs.fontFamily.split(',')[0],
        frameDrawn: !!frame?.querySelector('.rough-frame.is-drawn path, svg.rough-frame__drawing path'),
        iconShown: !!icon && getComputedStyle(icon).display !== 'none',
        label: el.closest('label')?.querySelector('span')?.textContent?.trim() || el.getAttribute('aria-label') || ''
      }
    })
  }, scope)
}

const results = {}

// 1. /plans：開「擬新計畫」dialog，看開始日／結束日
await page.goto(`${APP}/plans`, { waitUntil: 'networkidle0', timeout: 60000 })
await sleep(800)
const newBtn = await page.evaluateHandle(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes('擬')))
if (newBtn && await newBtn.evaluate(el => !!el)) {
  await newBtn.click()
  await sleep(900)
  results.plans = await inspectDates('.r-dialog')
  await page.screenshot({ path: `${OUT}/date-sketch-plans.png` })
} else {
  results.plans = '找不到「擬新計畫」鈕'
}

// 2. /daily：挑一人放進「五人名單」→ 驗證 cell 版日期欄 → 移出還原
await page.goto(`${APP}/daily`, { waitUntil: 'networkidle0', timeout: 60000 })
await sleep(1000)
results.daily = '無法加入測試列'
const trigger = await page.$('.worksheet [role="combobox"]')
if (trigger) {
  await trigger.click()
  await sleep(500)
  const opt = (await page.$$('button[role="option"], [role="option"]'))[0]
  if (opt) {
    await opt.click()
    await sleep(700)
    const addBtn = await page.evaluateHandle(() => [...document.querySelectorAll('.worksheet button')].find(b => b.textContent.includes('放進來')))
    if (addBtn && await addBtn.evaluate(el => !!el)) {
      await addBtn.click()
      await sleep(900)
      results.daily = await inspectDates('.worksheet')
      await page.screenshot({ path: `${OUT}/date-sketch-daily.png` })
      // 還原：移出該列
      const rm = await page.evaluateHandle(() => [...document.querySelectorAll('.row-step')].find(b => (b.getAttribute('aria-label') ?? '').includes('移出')))
      if (rm && await rm.evaluate(el => !!el)) {
        await rm.click()
        await sleep(600)
        results.dailyCleanup = '已移出還原'
      } else {
        results.dailyCleanup = '⚠️ 找不到移出鈕，測試列留在板上'
      }
    }
  }
}
// 截圖在加入列後、移出前已拍（上方 if 內），此處不再重拍覆蓋

// 3. /：點「Info」開明細 modal（最後跟進日＋新增紀錄日期；有紀錄再測 cell inline 編輯）
await page.goto(`${APP}/`, { waitUntil: 'networkidle0', timeout: 60000 })
await sleep(1000)
const infoBtn = await page.evaluateHandle(() => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Info'))
if (infoBtn && await infoBtn.evaluate(el => !!el)) {
  await infoBtn.click()
  await sleep(900)
  results.detail = await inspectDates('.r-dialog')
  // 時間軸若有紀錄：點日期 badge 進 inline cell 編輯
  const dateBadge = await page.evaluateHandle(() => document.querySelector('.log-date-edit'))
  if (dateBadge && await dateBadge.evaluate(el => !!el)) {
    await dateBadge.click()
    await sleep(400)
    results.detailInlineEdit = await inspectDates('.log-list')
  }
  await page.screenshot({ path: `${OUT}/date-sketch-detail.png` })
} else {
  results.detail = '名單沒有資料可開 modal'
}

// 4. 殘留檢查：全頁面不該再有未包手繪框的裸 type=date
const bareDates = await page.evaluate(() => [...document.querySelectorAll('input[type="date"]')].filter(el => !el.closest('.r-date__frame')).length)
results.bareDateInputs = bareDates
results.pageErrors = errors

console.log(JSON.stringify(results, null, 2))
await browser.close()
