// 手機版總名單寬度探查：375px 下量 .list-scroll 是否還有內部橫滾、可見欄與 Info 鈕位置
// 用法：先起 dev server（localhost:1138），再 bun tests/manual/list-width-probe.mjs
// 背景：手機版只留姓名／目標／今日跟進三欄＋Info，表格必須完全塞進容器（scrollWidth == clientWidth）
import puppeteer from 'puppeteer-core'

const APP = 'http://localhost:1138/'
const W = Number(process.argv[2] ?? 375)
const CHROME = process.env.CHROME_PATH ?? '/usr/bin/google-chrome'

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
const page = await browser.newPage()
await page.setViewport({ width: W, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
await page.goto(APP, { waitUntil: 'networkidle0', timeout: 60000 })
await new Promise(r => setTimeout(r, 1500))

const r = await page.evaluate(() => {
  const wrap = document.querySelector('.list-scroll')
  const info = document.querySelector('button[aria-label^="開啟"]')
  const heads = [...document.querySelectorAll('.list-scroll thead th')].filter(th => getComputedStyle(th).display !== 'none')
  return {
    vw: document.documentElement.clientWidth,
    wrapClient: wrap.clientWidth,
    wrapScroll: wrap.scrollWidth,
    hScroll: wrap.scrollWidth > wrap.clientWidth + 1,
    heads: heads.map(th => ({ t: th.textContent.trim().slice(0, 6) || '(動作)', w: Math.round(th.getBoundingClientRect().width) })),
    infoRight: info ? Math.round(info.getBoundingClientRect().right) : null
  }
})
console.log(JSON.stringify(r, null, 2))
console.log(r.hScroll ? 'X 名單表仍有內部橫滾' : 'OK 名單表完全塞進容器，無內部橫滾')
await browser.close()
