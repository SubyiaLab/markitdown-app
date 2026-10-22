// Structure-aware PDF -> Markdown. Takes a loaded pdf.js document so it also runs under Node for testing.

const BULLET = /^[•▪◦●■‣·\-–—*]\s+/
const NUMBERED = /^(\d+|[a-z])[.)]\s+/i

function lineFrom(items) {
  items.sort((a, b) => a.x - b.x)
  const size = Math.max(...items.map((i) => i.size))
  const segs = []
  let prevEnd = null
  for (const it of items) {
    const gap = prevEnd === null ? 0 : it.x - prevEnd
    if (prevEnd === null || gap > size * 0.8) segs.push({ x: it.x, text: it.str, end: it.x + it.w })
    else {
      const s = segs[segs.length - 1]
      const needSpace = gap > size * 0.15 && !/\s$/.test(s.text) && !/^\s/.test(it.str)
      s.text += (needSpace ? ' ' : '') + it.str
      s.end = it.x + it.w
    }
    prevEnd = it.x + it.w
  }
  segs.forEach((s) => (s.text = s.text.replace(/\s+/g, ' ').trim()))
  const chars = items.reduce((n, i) => n + i.str.length, 0)
  const boldChars = items.filter((i) => i.bold).reduce((n, i) => n + i.str.length, 0)
  const kept = segs.filter((s) => s.text)
  return { y: items[0].y, x: kept[0]?.x, size, segs: kept, bold: boldChars > chars * 0.8 }
}

async function pageLines(page) {
  const { items, styles } = await page.getTextContent()
  const raw = items
    .filter((i) => i.str.trim())
    .map((i) => {
      const fam = (styles[i.fontName]?.fontFamily || '') + ' ' + i.fontName
      return { str: i.str, x: i.transform[4], y: i.transform[5], w: i.width, size: Math.hypot(i.transform[2], i.transform[3]) || i.height, bold: /bold|black|heavy|semibold/i.test(fam) }
    })
    .sort((a, b) => b.y - a.y || a.x - b.x)
  const lines = []
  let cur = []
  for (const it of raw) {
    if (cur.length && Math.abs(it.y - cur[0].y) > Math.max(2, it.size * 0.4)) { lines.push(lineFrom(cur)); cur = [] }
    cur.push(it)
  }
  if (cur.length) lines.push(lineFrom(cur))
  return lines.filter((l) => l.segs.length)
}

function mdTable(group) {
  // column anchors: cluster segment start positions
  const xs = group.flatMap((l) => l.segs.map((s) => s.x)).sort((a, b) => a - b)
  const cols = []
  for (const x of xs) if (!cols.length || x - cols[cols.length - 1] > 12) cols.push(x)
  const rows = group.map((l) => {
    const row = Array(cols.length).fill('')
    for (const s of l.segs) {
      let c = 0
      for (let i = 0; i < cols.length; i++) if (s.x >= cols[i] - 12) c = i
      row[c] = row[c] ? row[c] + ' ' + s.text : s.text
    }
    return row.map((t) => t.replace(/\|/g, '\\|'))
  })
  const line = (r) => `| ${r.join(' | ')} |`
  return [line(rows[0]), line(rows[0].map(() => '---')), ...rows.slice(1).map(line)].join('\n')
}

export async function pdfToMarkdown(doc) {
  const pages = []
  for (let p = 1; p <= doc.numPages; p++) pages.push(await pageLines(await doc.getPage(p)))

  // body font size = most common size, weighted by characters
  const weight = new Map()
  for (const l of pages.flat()) {
    const k = Math.round(l.size * 2) / 2
    weight.set(k, (weight.get(k) || 0) + l.segs.reduce((n, s) => n + s.text.length, 0))
  }
  const body = [...weight.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 10

  const out = []
  for (const lines of pages) {
    const blocks = []
    let para = null
    let prev = null
    const left = Math.min(...lines.map((l) => l.x))
    const right = Math.max(...lines.map((l) => l.segs[l.segs.length - 1].end))
    const flush = () => { if (para) blocks.push(para.join(' ').replace(/(\w)- (\w)/g, '$1$2')); para = null }

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]
      // table: run of >=2 consecutive multi-segment lines
      if (l.segs.length >= 2) {
        let j = i
        while (j < lines.length && lines[j].segs.length >= 2) j++
        if (j - i >= 2) { flush(); blocks.push(mdTable(lines.slice(i, j))); i = j - 1; prev = null; continue }
      }
      const text = l.segs.map((s) => s.text).join(' ')
      const ratio = l.size / body
      const short = text.length < 120
      if (short && ratio >= 1.15) {
        flush()
        blocks.push(`${ratio >= 1.8 ? '#' : ratio >= 1.4 ? '##' : '###'} ${text}`)
      } else if (short && l.bold && text.length < 80 && !/[.,;:]$/.test(text) && !BULLET.test(text)) {
        flush()
        blocks.push(`### ${text}`)
      } else if (BULLET.test(text)) {
        flush()
        blocks.push(`- ${text.replace(BULLET, '')}`)
      } else if (short && l.x - left >= l.size * 1.5 && (!para || prev.x < l.x)) {
        // marker glyphs are often not extractable; an indented short line is a list item
        flush()
        blocks.push(`- ${text}`)
      } else if (NUMBERED.test(text)) {
        flush()
        blocks.push(text)
      } else {
        const prevEnd = prev ? prev.segs[prev.segs.length - 1].end : 0
        const newPara = !para || !prev || prev.y - l.y > l.size * 1.8 || prevEnd < right - l.size * 4
        if (newPara) { flush(); para = [text] } else para.push(text)
      }
      prev = l
    }
    flush()

    // keep consecutive list items tight
    out.push(blocks.reduce((acc, b, i) => {
      const listy = (s) => s.startsWith('- ') || NUMBERED.test(s)
      return acc + (i === 0 ? '' : i > 0 && listy(b) && listy(blocks[i - 1]) ? '\n' : '\n\n') + b
    }, ''))
  }
  return out.filter(Boolean).join('\n\n---\n\n')
}
