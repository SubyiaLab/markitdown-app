# MarkItDown

A small app that converts documents to Markdown, inspired by Microsoft's MarkItDown. Everything runs locally: files never leave your machine.

**Supported:** PDF (headings, lists, tables, paragraphs), DOCX, PPTX, XLSX/XLS/CSV, HTML, JSON, XML, TXT/MD, images (embedded as data URIs).

## Use it

- **Windows:** build the installer with `npm run dist:win` (output in `release/`), or download it from the Releases page once a `v*` tag has been pushed.
- **macOS / any browser:** open the hosted web app (GitHub Pages) and install it: Safari -> File -> *Add to Dock*, or Chrome -> *Install MarkItDown*. It works offline after the first visit.

## Develop

```
npm install
npm run dev        # web app at http://localhost:5173
npm run electron   # desktop app
npm run dist:win   # Windows installer
```

## Limitations

PDF structure is inferred from font size, position and spacing, so scanned PDFs (no text layer) and complex layouts won't convert well. No OCR, audio or YouTube support.

## License

MIT
