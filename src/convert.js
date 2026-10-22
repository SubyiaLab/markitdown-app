import mammoth from 'mammoth'
import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'
import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import * as XLSX from 'xlsx'
import JSZip from 'jszip'
import { pdfToMarkdown } from './pdf.js'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

const td = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', codeBlockStyle: 'fenced' })
td.use(gfm)

const ext = (name) => name.split('.').pop().toLowerCase()

export const SUPPORTED = 'pdf, docx, pptx, xlsx, xls, csv, html, json, xml, txt, md, images'

function table(rows) {
  if (!rows.length) return ''
  const width = Math.max(...rows.map((r) => r.length))
  const norm = rows.map((r) => Array.from({ length: width }, (_, i) => String(r[i] ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')))
  const line = (r) => `| ${r.join(' | ')} |`
  return [line(norm[0]), line(norm[0].map(() => '---')), ...norm.slice(1).map(line)].join('\n')
}

async function pdf(file) {
  return pdfToMarkdown(await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise)
}

async function docx(file) {
  const { value } = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() })
  return td.turndown(value)
}

async function pptx(file) {
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const num = (n) => parseInt(n.match(/(\d+)\.xml$/)[1], 10)
  const slides = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => num(a) - num(b))
  const out = []
  for (const [i, name] of slides.entries()) {
    const xml = new DOMParser().parseFromString(await zip.file(name).async('string'), 'application/xml')
    const paras = [...xml.getElementsByTagName('a:p')]
      .map((p) => [...p.getElementsByTagName('a:t')].map((t) => t.textContent).join(''))
      .filter(Boolean)
    const [title, ...rest] = paras
    out.push(`<!-- Slide ${i + 1} -->\n# ${title ?? `Slide ${i + 1}`}\n\n${rest.map((l) => `- ${l}`).join('\n')}`.trim())
  }
  return out.join('\n\n')
}

async function sheet(file) {
  const wb = XLSX.read(await file.arrayBuffer())
  return wb.SheetNames.map((n) => `## ${n}\n\n${table(XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, blankrows: false }))}`).join('\n\n')
}

const image = (file) =>
  new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(`![${file.name}](${r.result})`)
    r.onerror = rej
    r.readAsDataURL(file)
  })

export async function convert(file) {
  const e = ext(file.name)
  switch (e) {
    case 'pdf': return pdf(file)
    case 'docx': return docx(file)
    case 'pptx': return pptx(file)
    case 'xlsx': case 'xls': case 'csv': return sheet(file)
    case 'html': case 'htm': return td.turndown(await file.text())
    case 'json': return '```json\n' + JSON.stringify(JSON.parse(await file.text()), null, 2) + '\n```'
    case 'xml': return '```xml\n' + (await file.text()) + '\n```'
    case 'md': case 'txt': return file.text()
    case 'png': case 'jpg': case 'jpeg': case 'gif': case 'webp': case 'svg': return image(file)
    default: throw new Error(`Unsupported file type ".${e}". Supported: ${SUPPORTED}`)
  }
}
