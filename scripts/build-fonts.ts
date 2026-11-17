/**
 * NaikaiFont 手繪字體切片（subset）腳本 —— 只保留這個 CRM 用得到的字，
 * 把 Regular 2.1MB／Bold 3.3MB 的官方 tw/ 全字表砍到约 1.3MB／1.9MB，
 * 縮短進入畫面時「先看到備援字體、之後才換手繪字體」（FOUT）的時間。
 *
 * 用法：`bun run fonts:build`（改了 UI 文字或想補新字時重跑，产物直接覆蓋 public/fonts/）
 *
 * 字表 = 教育部《常用國字標準字體表》4,808 字（scripts/fonts/common-std-chinese.txt，
 *        覆盖绝大多数人名与中文输入）
 *      ∪ app/、shared/ 原始码全部字元（静态 UI 文案）
 *      ∪ data/crm.db 所有文字值（既存人名／阶段名／备注用字）
 *      ∪ 常用符号区段（ASCII、标点、全形、假名、注音、箭头、数学符号等）
 * 缺字时浏览器会逐字退回 sans-serif，不会断行或空白，属可接受的降级。
 *
 * 母檔＝官方 tw/ 切片版，固定在 git 提交 eed4197（public/fonts 现檔已被切片版取代，
 * 每次从该提交用 `git show` 取回，产线可重出、不会「切了再切」越切越少）。
 * 授权：SIL OFL 1.1（见 public/fonts/OFL.txt）。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Database } from 'bun:sqlite'
import subsetFont from 'subset-font'

const ROOT = join(import.meta.dir, '..')
const MASTER_COMMIT = 'eed4197'
const MASTER_DIR = 'public/fonts'
const CACHE_DIR = join(import.meta.dir, '.font-cache')
const FONTS = ['NaikaiFont-Regular-Lite.woff2', 'NaikaiFont-Bold-Lite.woff2'] as const

/** 常用符号区段（母檔没有的码位 harfbuzz 会自动忽略） */
const SYMBOL_RANGES: Array<[number, number]> = [
  [0x20, 0x7e], // ASCII
  [0xa0, 0xff], // Latin-1（± ° · ½）
  [0x2000, 0x209f], // 通用标點＋上下标（— ‘’ † ‰ ²）
  [0x20a0, 0x20bf], // 货币（€）
  [0x2100, 0x218f], // 字母式记号＋数字符号（№ ™）
  [0x2190, 0x22ff], // 箭头＋数学（→ × ÷ ≤ ≈）
  [0x2460, 0x24ff], // 带圈编号（①⑴⒈）
  [0x2500, 0x25ff], // 制表符＋几何图形（─ ■ ●）
  [0x2600, 0x27bf], // 杂项符号与装饰符号（✓ ✏ ★）
  [0x3000, 0x30ff], // CJK 符号标点＋假名
  [0x3100, 0x312f], // 注音（ㄅㄆㄇ）
  [0xff01, 0xff60], // 全形标點与数字（（）０-９）
  [0xffe0, 0xffe6] // 全形货币记号
]

function charsFromRanges(ranges: Array<[number, number]>): string[] {
  const chars: string[] = []
  for (const [start, end] of ranges)
    for (let cp = start; cp <= end; cp++) chars.push(String.fromCodePoint(cp))
  return chars
}

/** 遞迴收集目录下所有 .vue/.ts 原始码字元（静态 UI 文案、日期格式符号线） */
function collectSourceChars(dir: string, into: Set<string>) {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.nuxt') continue
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) collectSourceChars(path, into)
    else if (/\.(vue|ts)$/.test(entry)) for (const ch of readFileSync(path, 'utf8')) into.add(ch)
  }
}

/** 本地 SQLite 资料库所有文字值（dev 样本人名／阶段名等）；档案不在或锁定就略过 */
function collectDbChars(dbPath: string, into: Set<string>) {
  if (!existsSync(dbPath)) return false
  try {
    const db = new Database(dbPath, { readonly: true })
    const tables = db.query(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`).all() as Array<{ name: string }>
    for (const t of tables) {
      for (const row of db.query(`SELECT * FROM "${t.name}"`).all() as Array<Record<string, unknown>>) {
        for (const value of Object.values(row)) {
          if (typeof value === 'string') for (const ch of value) into.add(ch)
        }
      }
    }
    db.close()
    return true
  } catch (err) {
    console.warn(`⚠️ 略过 ${dbPath}：${(err as Error).message}`)
    return false
  }
}

/** 从固定提交取回官方 tw/ 母檔（有快取就不重复取） */
function masterBuffer(font: string): Buffer {
  const cached = join(CACHE_DIR, font)
  if (existsSync(cached) && statSync(cached).size > 0) return readFileSync(cached)
  mkdirSync(CACHE_DIR, { recursive: true })
  const buf = execFileSync('git', ['show', `${MASTER_COMMIT}:${MASTER_DIR}/${font}`], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 })
  writeFileSync(cached, buf)
  return buf
}

// ── 组字表 ────────────────────────────────────────────────────────────
const chars = new Set<string>(charsFromRanges(SYMBOL_RANGES))
for (const ch of readFileSync(join(ROOT, 'scripts/fonts/common-std-chinese.txt'), 'utf8'))
  if (/\p{Script=Han}/u.test(ch)) chars.add(ch)
collectSourceChars(join(ROOT, 'app'), chars)
collectSourceChars(join(ROOT, 'shared'), chars)
const dbSeen = collectDbChars(join(ROOT, 'data/crm.db'), chars)

const text = [...chars].join('')
console.log(`字表：${chars.size} 码位（含常用汉字 4808，UI 原始码＋${dbSeen ? '本地 DB ' : ''}符号已并入）`)

// ── 切片并覆盖 public/fonts ──────────────────────────────────────────
for (const font of FONTS) {
  const src = masterBuffer(font)
  // preserveNameIds：harfbuzz 預設會丟 name ID 13/14（授權說明／連結），
  // NaikaiFont 採 SIL OFL，這些紀錄要跟著字檔走。
  // （Bold 母檔在更早的切片就把 13/14 洗掉了，授權文字以隨附的 public/fonts/OFL.txt 為準）
  const out = await subsetFont(Buffer.from(src), text, {
    targetFormat: 'woff2',
    preserveNameIds: [13, 14]
  })
  writeFileSync(join(ROOT, MASTER_DIR, font), out)
  const mb = (n: number) => (n / 1048576).toFixed(2)
  console.log(`${font}: ${mb(src.length)} MB → ${mb(out.length)} MB`)
}
console.log('完成。public/fonts 已更新，记得 git commit 新字体档。')
