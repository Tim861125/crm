// 明細 modal 全按鈕流程實測 v3：開 5 個下拉（選第一個 option 關閉）→ 儲存 → 加一筆 → 刪紀錄
import puppeteer from 'puppeteer-core'

const APP = 'http://localhost:1138/'
const errors = []
const log = []
let confirmMsg

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage']
})
const page = await browser.newPage()
page.on('pageerror', e => errors.push(`[pageerror] ${e.message.slice(0, 600)}`))
page.on('dialog', async (d) => {
  confirmMsg = d.message()
  await d.accept()
})
await page.goto(APP, { waitUntil: 'networkidle0', timeout: 30000 })
await new Promise(r => setTimeout(r, 800))

// 1) 開明細 modal
await page.click('button[title="明細"]')
await new Promise(r => setTimeout(r, 1200))
const text = await page.evaluate(() => document.body.innerText)
log.push(`[開 modal] ${text.includes('跟進紀錄') ? '成功' : '失敗'}`)

async function modalOpen() {
  return page.evaluate(() => !!document.body.innerText.includes('跟進紀錄'))
}

// 2) 逐個點開下拉、選第一個（－）option 關閉（不用 Escape，避免關到 modal）
const { count } = await page.evaluate(() => ({
  count: document.querySelectorAll('[role="combobox"]').length
}))
log.push(`[下拉數量] ${count}`)
for (let i = 0; i < count; i++) {
  const before = errors.length
  try {
    // 重新抓觸發器（DOM 會因 v-model 變動重渲染）
    const triggers = await page.$$('[role="combobox"]')
    await triggers[i].click()
    await new Promise(r => setTimeout(r, 500))
    const opt = await page.$('[role="option"]')
    if (opt) {
      await opt.click().catch(() => {})
      await new Promise(r => setTimeout(r, 400))
    }
  } catch (e) {
    log.push(`[下拉 #${i}] 點擊異常：${String(e.message).slice(0, 80)}`)
  }
  log.push(`[下拉 #${i}] ${errors.length > before ? '✗ throw' : 'ok'}（modal 仍開：${await modalOpen()}）`)
}
await page.$('[role="option"]').catch(() => {})

// 3) 儲存
{
  const before = errors.length
  const btns = await page.$$('button')
  for (const b of btns) {
    const t = await b.evaluate(el => el.textContent.trim())
    if (t.includes('儲存')) {
      await b.click()
      break
    }
  }
  await new Promise(r => setTimeout(r, 1500))
  log.push(`[儲存] throw:${errors.length > before ? '有' : '無'}；toast 區域：`)
}

// 4) 加一筆
{
  const before = errors.length
  const btns = await page.$$('button')
  for (const b of btns) {
    const t = await b.evaluate(el => el.textContent.trim())
    if (t.includes('加一筆')) {
      await b.click()
      break
    }
  }
  await new Promise(r => setTimeout(r, 1500))
  const body = await page.evaluate(() => document.body.innerText)
  log.push(`[加一筆] throw:${errors.length > before ? '有' : '無'}；時間軸含「今天」：${body.split('\n').includes('今天')}`)
}

// 5) 刪除紀錄
{
  const before = errors.length
  const erase = await page.$$('button[title="刪除紀錄"]')
  if (erase.length) {
    await erase[erase.length - 1].click()
    await new Promise(r => setTimeout(r, 500))
    await page.evaluate(() => { /* confirm 應該已被 accept */ })
    await new Promise(r => setTimeout(r, 1500))
  }
  const after = await page.$$('button[title="刪除紀錄"]')
  log.push(`[刪除紀錄] confirm：「${confirmMsg || '沒有'}」；按鈕 ${erase.length} → ${after.length}；throw:${errors.length > before ? '有' : '無'}`)
}

console.log('────── 點擊結果 ──────')
for (const l of log) console.log(l)
console.log('────── pageerror ──────')
for (const e of errors) console.log(e)
if (!errors.length) console.log('（無）')
await browser.close()
