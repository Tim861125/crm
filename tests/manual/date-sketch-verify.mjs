// 手繪日期輸入（RDateInput）實渲驗證：/plans 編輯器、/daily worksheet cell、/ 明细 modal
// 並驗證自繪手繪日曆面板：開面板（手繪框／週格／42 格）、點選日寫回 yyyy-mm-dd、今天鈕、Esc 收合
// 用法：bun run dev 後 `node tests/manual/date-sketch-verify.mjs`（截圖輸出到 /tmp/opencode/）
import puppeteer from 'puppeteer-core'

const APP = 'http://localhost:1138'
const OUT = process.env.OUT_DIR ?? '/tmp/opencode'
const sleep = ms => new Promise(r => setTimeout(r, ms))

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
  // 桌面手繪面板路徑的驗證需要 hover:hover／pointer:fine——headless Chrome 回報 none 且
  // CDP setEmulatedMedia 無效，須 headful 跑：`xvfb-run -a HEADED=1 node tests/manual/date-sketch-verify.mjs`
  headless: !process.env.HEADED,
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

// 1b. /plans 手繪面板互動：開面板 → 結構檢查 → 選 15 日 → 「今天」鈕 → Esc 收合（dialog 不受影響）
if (results.plans !== '找不到「擬新計畫」鈕') {
  const field = await page.$('.r-dialog .r-date__field')
  if (field) {
    await field.click()
    await sleep(450)
    results.panel = await page.evaluate(() => {
      const pop = document.querySelector('.r-pop-menu .r-cal')
      if (!pop) return '面板沒開（.r-cal 不存在）'
      return {
        weekdays: pop.querySelectorAll('.r-cal__wd').length,
        cells: pop.querySelectorAll('.r-cal__cell').length,
        navs: [...pop.querySelectorAll('.r-cal__nav')].map(b => b.getAttribute('aria-label')),
        heading: pop.querySelector('.r-cal__heading')?.textContent?.trim(),
        panelDrawn: !!document.querySelector('.r-cal__panel .rough-frame__drawing path'),
        footBtns: [...pop.querySelectorAll('.r-cal__foot-btn')].map(b => b.textContent.trim())
      }
    })
    await page.screenshot({ path: `${OUT}/date-sketch-panel.png` })
    // 點選本月 15 日（ DOM click 走 reka trigger；選完應收合並把值寫回原生 input）
    const cellLabel = await page.evaluate(() => {
      const cell = [...document.querySelectorAll('.r-cal__cell:not([data-outside-view]):not([data-disabled])')]
        .find(c => c.querySelector('.r-cal__num')?.textContent?.trim() === '15')
      if (!cell) return '(找不到 15 日格)'
      cell.click()
      return cell.getAttribute('aria-label')
    })
    await sleep(450)
    results.pickDay = {
      cellLabel,
      value: await page.$eval('.r-dialog .r-date', el => el.value),
      panelClosed: !(await page.$('.r-pop-menu .r-cal'))
    }
    // 再開面板：選中日應有手繪圈（RoughFrame ellipse 已畫出）＋「今天」鈕可用
    await field.click()
    await sleep(450)
    results.ringDrawn = await page.evaluate(() =>
      !!document.querySelector('.r-cal__cell[data-selected] .r-cal__ring .rough-frame__drawing path'))
    await page.evaluate(() =>
      [...document.querySelectorAll('.r-cal__foot-btn')].find(b => b.textContent.includes('今天'))?.click())
    await sleep(450)
    results.pickToday = {
      value: await page.$eval('.r-dialog .r-date', el => el.value),
      expect: await page.evaluate(() => {
        const n = new Date()
        return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
      })
    }
    // Esc 收合面板：focus 回欄位、外層 dialog 不收合
    await field.click()
    await sleep(450)
    await page.keyboard.press('Escape')
    await sleep(450)
    results.escClose = {
      panelClosed: !(await page.$('.r-pop-menu .r-cal')),
      dialogStillOpen: !!(await page.$('.r-dialog')),
      focusInDateInput: await page.evaluate(() => document.activeElement?.classList.contains('r-date'))
    }
    await page.keyboard.press('Escape') // 收 dialog
    await sleep(400)
  } else {
    results.panel = '找不到日期欄位'
  }
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
