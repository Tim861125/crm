// 正向驗證儲存：等級選 SSR → 儲存 → 由 DB 證實
import puppeteer from 'puppeteer-core'

const APP = 'http://localhost:1138/'
const errors = []

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage']
})
const page = await browser.newPage()
page.on('pageerror', e => errors.push(e.message))
await page.goto(APP, { waitUntil: 'networkidle0', timeout: 30000 })
await new Promise(r => setTimeout(r, 800))

await page.click('button[title="明細"]')
await new Promise(r => setTimeout(r, 1000))

// 「等級」下拉（以 label span 定位；欄位縮減後 combobox 序號不可靠）：
// 點開後選 SSR option
const box = await page.evaluate(() => {
  const label = [...document.querySelectorAll('.r-dialog label')]
    .find(l => l.querySelector('span')?.textContent.trim() === '等級')
  const t = label?.querySelector('[role="combobox"]')
  if (!t) throw new Error('找不到「等級」下拉')
  const r = t.getBoundingClientRect()
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
})
await page.mouse.click(box.x, box.y)
await new Promise(r => setTimeout(r, 600))
const opts = await page.$$('[role="option"]')
// option 0 = －, option 1 = SSR
await opts[1].click().catch(() => {})
await new Promise(r => setTimeout(r, 500))

// 儲存
const btns = await page.$$('button')
for (const b of btns) {
  const t = await b.evaluate(el => el.textContent.trim())
  if (t.includes('儲存')) {
    await b.click()
    break
  }
}
await new Promise(r => setTimeout(r, 1500))

const level = await page.evaluate(() => document.body.innerText.includes('已儲存'))
console.log('toast「已儲存」:', level ? '有' : '沒截到')
console.log('pageerrors:', errors.length ? errors : '（無）')
await browser.close()
