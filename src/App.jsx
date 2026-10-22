import { useRef, useState } from 'react'
import { marked } from 'marked'
import { convert, SUPPORTED } from './convert.js'

export default function App() {
  const [items, setItems] = useState([]) // {id, name, status, md, error}
  const [active, setActive] = useState(null)
  const [view, setView] = useState('markdown')
  const [drag, setDrag] = useState(false)
  const input = useRef()

  const update = (id, patch) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)))

  async function addFiles(files) {
    for (const file of files) {
      const id = crypto.randomUUID()
      setItems((xs) => [...xs, { id, name: file.name, status: 'working' }])
      setActive((a) => a ?? id)
      try {
        update(id, { status: 'done', md: await convert(file) })
      } catch (e) {
        update(id, { status: 'error', error: e.message })
      }
    }
  }

  const cur = items.find((x) => x.id === active)
  const download = (x) => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([x.md], { type: 'text/markdown' }))
    a.download = x.name.replace(/\.[^.]+$/, '') + '.md'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="app" onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles([...e.dataTransfer.files]) }}>
      <aside>
        <h1>MarkItDown</h1>
        <button className="primary" onClick={() => input.current.click()}>+ Add files</button>
        <input ref={input} type="file" multiple hidden onChange={(e) => { addFiles([...e.target.files]); e.target.value = '' }} />
        <ul>
          {items.map((x) => (
            <li key={x.id} className={x.id === active ? 'sel' : ''} onClick={() => setActive(x.id)}>
              <span className="name">{x.name}</span>
              <span className={`badge ${x.status}`}>{x.status}</span>
              <button className="x" title="Remove" onClick={(e) => { e.stopPropagation(); setItems((xs) => xs.filter((y) => y.id !== x.id)); if (active === x.id) setActive(null) }}>×</button>
            </li>
          ))}
        </ul>
        {items.some((x) => x.md) && <button onClick={() => items.filter((x) => x.md).forEach(download)}>Save all .md</button>}
      </aside>
      <main>
        {!cur && (
          <div className={`drop ${drag ? 'over' : ''}`} onClick={() => input.current.click()}>
            <p>Drop files here or click to browse</p>
            <small>{SUPPORTED}</small>
            <small>Everything is converted locally in your browser.</small>
          </div>
        )}
        {cur?.status === 'working' && <p className="msg">Converting…</p>}
        {cur?.status === 'error' && <p className="msg err">{cur.error}</p>}
        {cur?.md != null && (
          <>
            <div className="bar">
              <div className="tabs">
                {['markdown', 'preview'].map((v) => <button key={v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>{v}</button>)}
              </div>
              <div>
                <button onClick={() => navigator.clipboard.writeText(cur.md)}>Copy</button>
                <button className="primary" onClick={() => download(cur)}>Save .md</button>
              </div>
            </div>
            {view === 'markdown'
              ? <textarea value={cur.md} onChange={(e) => update(cur.id, { md: e.target.value })} spellCheck={false} />
              : <div className="preview" dangerouslySetInnerHTML={{ __html: marked.parse(cur.md) }} />}
          </>
        )}
        {drag && cur && <div className="overlay">Drop to convert</div>}
      </main>
    </div>
  )
}
