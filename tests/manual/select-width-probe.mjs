// 下拉（combobox）觸發寬度實測：選不同長度的選項後，觸發器寬度是否變化
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
await page.goto(APP, { waitUntil: 'networkidle0', timeout: 30000 })
await sleep(800)
await page.click('button[title="明細"]')
await sleep(1200)

const comboInfo = `
  (function () {
    return [...document.querySelectorAll('[role="combobox"]')].map((el, i) => ({
      i, label: el.closest('label')?.querySelector('span')?.textContent?.trim() ?? '',
      w: +el.getBoundingClientRect().width.toFixed(1),
      text: el.textContent.trim().slice(0, 12)
    }))
  })
`
const measure = () => page.evaluate(`(${comboInfo})()`)

const combos = await measure()
console.log(`找到 ${combos.length} 個下拉`)
for (const c of combos) {
  // 重新抓取（DOM 可能重渲染）
  const triggers = await page.$$('[role="combobox"]')
  await triggers[c.i].click()
  await sleep(400)
  // 選最後一個 option（通常較長或不同長度）
  const opts = await page.$$('[role="option"]')
  if (!opts.length) { console.log(`[${c.label}] 無 option`); continue }
  const texts = await Promise.all(opts.map(o => o.evaluate(el => el.textContent.trim())))
  const longest = texts.reduce((a, b, bi, arr) => b.length > arr[a].length ? bi : a, 0)
  await opts[longest].click().catch(() => {})
  await sleep(400)
  const after = (await measure())[c.i]
  const back = await page.$$('[role="combobox"]')
  await back[c.i].click()
  await sleep(300)
  const o2 = await page.$$('[role="option"]')
  if (o2[0]) { await o2[0].click().catch(() => {}); await sleep(300) } // 選回第一項（－）还原
  const rest = (await measure())[c.i]
  console.log(
    `${Math.abs(after.w - c.w) > 0.5 ? '✗ 變形' : '  穩定'}  [${c.label}] ${c.text}(${c.w}) → 「${texts[longest]}」(${after.w})｜還原(${rest.w})`
  )
}
await browser.close()
