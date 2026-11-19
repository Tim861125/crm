// 驗證總名單「欄位多選篩選」（ColumnFilterMenu）：
//   1. 六個可篩欄位（進度／地點／聯絡／目標／跟進／已跟進）表頭是篩選鈕，姓名不是
//   2. 點欄名開面板：選項由資料推導（含「未設定」與筆數）
//   3. 同欄多選＝OR；跨欄＝AND；勾選不收合面板
//   4. 啟用中表頭染 is-active；面板「清除已選」與空結果「清除所有篩選」都還原全部
//   5. 已跟進欄可筛「已跟進／未跟進」
//   6. 全程無 pageerror
// 用法：先起 dev server（localhost:1138），再 bun tests/manual/column-filter-verify.mjs
// 測資為新建探针，測完刪除，不動既有資料
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

const post = async (url, body) => (await (await fetch(`${APP}${url}`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body)
})).json())
const patch = async (id, body) => (await (await fetch(`${APP}api/contacts/${id}`, {
  method: 'PATCH',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body)
})).json())

// 探针三人：地點A/線A/目標A/一週/階段s1/今天跟進、地點B/線A/目標B/暫停/無階段、全空
const probes = []
let createdStage = null
try {
  const stages = await (await fetch(`${APP}api/contact-stages`)).json()
  let s1 = stages[0]?.id
  if (s1 === undefined) {
    createdStage = await post('api/contact-stages', { label: '篩選驗證階段' })
    s1 = createdStage.id
  }
  const a = await post('api/contacts', { name: '篩選探针甲' })
  const b = await post('api/contacts', { name: '篩選探针乙' })
  const c = await post('api/contacts', { name: '篩選探针丙' })
  probes.push(a, b, c)
  await patch(a.id, { location: '篩選地A', contact: '篩選線A', goal: '篩選目標A', followUpFreq: '一週一次', completedStages: [s1], lastFollowUp: new Date().toISOString().slice(0, 10) })
  await patch(b.id, { location: '篩選地B', contact: '篩選線A', goal: '篩選目標B', followUpFreq: '暫停' })

  await page.goto(APP, { waitUntil: 'networkidle0', timeout: 30000 })
  await sleep(800)

  // 1) 表頭：六個篩選鈕＋姓名非按鈕
  const filterHeaders = await page.$$eval('.list-scroll thead button.th-filter span', els => els.map(e => e.textContent.trim()))
  check('六個欄位標題是篩選鈕', ['進度', '地點', '聯絡', '目標', '跟進', '已跟進'].every(h => filterHeaders.includes(h)), filterHeaders.join('/'))
  const nameTh = await page.$eval('.list-scroll thead th:first-child', el => el.textContent.trim())
  check('姓名不是篩選鈕', nameTh === '姓名' && !await page.$('.list-scroll thead th:first-child button.th-filter'))

  // 面板／勾選 helper：
  // - 面板開著時點同欄 trigger 會收合（reka toggle）→ openHeader 先確認目标是否已開
  // - 收合中的舊面板留在 DOM（Presence 等 animationend）→ 一切查詢只認 [data-state="open"]
  const OPEN_PANEL = '.r-pop-menu[data-state="open"]'
  const openHeader = async (label) => {
    const isOpen = await page.evaluate(l => [...document.querySelectorAll('.list-scroll thead button.th-filter')]
      .find(b => b.textContent.trim() === l)?.getAttribute('data-state') === 'open', label)
    if (!isOpen) {
      await page.click('h1') // trusted 點擊表頭以外處，收合其他欄已開面板
      await sleep(300)
      await page.evaluate(l => [...document.querySelectorAll('.list-scroll thead button.th-filter')]
        .find(b => b.textContent.trim() === l)?.click(), label)
      await sleep(350)
    }
    return await page.evaluate(sel => !!document.querySelector(`${sel} .r-filter__panel`), OPEN_PANEL)
  }
  const panelOptionTexts = () => page.$$eval(`${OPEN_PANEL} .r-filter__row`, els => els.map(e => e.textContent.trim()))
  const checkOption = async (text) => {
    const found = await page.evaluate((sel, t) => {
      const row = [...document.querySelectorAll(`${sel} .r-filter__row`)]
        .find(r => r.querySelector('.r-choice span')?.textContent.trim() === t)
      row?.querySelector('[role="checkbox"]')?.click()
      return !!row
    }, OPEN_PANEL, text)
    await sleep(450)
    return found
  }
  const probeVisible = id => page.evaluate(i => !!document.querySelector(`tr[data-id="${i}"]`), id)
  const isActive = label => page.evaluate(l => [...document.querySelectorAll('.list-scroll thead button.th-filter.is-active')]
    .some(b => b.textContent.trim() === l), label)
  const heading = () => page.$eval('.page-heading p', el => el.textContent.replace(/\s+/g, ' ').trim())

  // 2) 地點面板：選項含探针值與「未設定」，並帶筆數
  check('點「地點」開啟篩選面板', await openHeader('地點'))
  const locOpts = await panelOptionTexts()
  check('選項含探针地點與未設定＋筆數', locOpts.some(t => t.includes('篩選地A')) && locOpts.some(t => t.includes('篩選地B')) && /未設定.*\d/.test(locOpts.at(-1) ?? ''), locOpts.join('｜'))

  // 3) 單選→OR→AND
  check('勾「篩選地A」成功', await checkOption('篩選地A'))
  check('只剩甲可見', await probeVisible(probes[0].id) && !await probeVisible(probes[1].id) && !await probeVisible(probes[2].id))
  check('標題顯示 顯示 X / Y 筆', /顯示 \d+ \/ \d+ 筆/.test(await heading()), await heading())
  check('地點表頭啟用中（is-active）', await isActive('地點'))
  await openHeader('地點')
  check('同欄再勾「篩選地B」＝OR', await checkOption('篩選地B'))
  check('甲＋乙可見、丙仍隱藏', await probeVisible(probes[0].id) && await probeVisible(probes[1].id) && !await probeVisible(probes[2].id))

  await openHeader('進度')
  check('進度面板只列有人完成的階段', (await panelOptionTexts()).some(t => t.includes('篩選驗證階段') || t.length > 0))
  const stageLabel = stages[0]?.label ?? '篩選驗證階段'
  check(`勾階段「${stageLabel}」跨欄 AND`, await checkOption(stageLabel))
  check('只剩甲（乙沒完成該階段）', await probeVisible(probes[0].id) && !await probeVisible(probes[1].id))

  // 4) 湊出零結果 → 空結果分支＋一鍵清除
  await openHeader('目標')
  check('勾「篩選目標B」湊出零結果', await checkOption('篩選目標B'))
  const emptyText = await page.$eval('.empty-cell', el => el.textContent.replace(/\s+/g, ' ').trim())
  check('空結果顯示篩選提示＋清除鈕', emptyText.includes('目前篩選条件下沒有名單') && emptyText.includes('清除所有篩選'), emptyText)
  await page.evaluate(() => [...document.querySelectorAll('.empty-cell button')].find(b => b.textContent.includes('清除所有篩選'))?.click())
  await sleep(500)
  check('一鍵清除後三人皆可見', await probeVisible(probes[0].id) && await probeVisible(probes[1].id) && await probeVisible(probes[2].id))
  check('is-active 全消失', !await isActive('地點') && !await isActive('進度') && !await isActive('目標'))

  // 5) 已跟進欄：勾「已跟進」只剩甲（甲最後跟進日＝今天）
  await openHeader('已跟進')
  const follOpts = await panelOptionTexts()
  check('已跟進面板含已跟進／未跟進', follOpts.some(t => t.includes('已跟進')) && follOpts.some(t => t.includes('未跟進')), follOpts.join('｜'))
  check('勾「已跟進」', await checkOption('已跟進'))
  check('只剩甲可見', await probeVisible(probes[0].id) && !await probeVisible(probes[1].id))
  await openHeader('已跟進')
  const cleared = await page.evaluate((sel) => {
    const btn = [...document.querySelectorAll(`${sel} button`)].find(b => b.textContent.includes('清除已選'))
    btn?.click()
    return !!btn
  }, OPEN_PANEL)
  await sleep(450)
  check('面板「清除已選」還原', cleared && await probeVisible(probes[1].id))
} catch (err) {
  check('探針流程完成', false, String(err instanceof Error ? err.message : err))
} finally {
  for (const p of probes)
    await fetch(`${APP}api/contacts/${p.id}`, { method: 'DELETE' }).catch(() => {})
  if (createdStage)
    await fetch(`${APP}api/contact-stages/${createdStage.id}`, { method: 'DELETE' }).catch(() => {})
  check('無 pageerror', errors.length === 0, errors.join(' | '))
  await browser.close()
  console.log(failures.length ? `✗ 失敗 ${failures.length} 項：${failures.join('、')}` : '✓ 全部通過')
  process.exit(failures.length ? 1 : 0)
}
