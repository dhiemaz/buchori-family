const express = require('express')
const Database = require('better-sqlite3')

const app  = express()
const PORT = process.env.PORT || 3001
const DB_PATH = process.env.DB_PATH || '/data/family.db'

app.use(express.json({ limit: '10mb' }))

// CORS – only needed if frontend is on a different origin (dev mode)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.sendStatus(200)
  next()
})

// Init DB
const db = new Database(DB_PATH)
db.exec(`CREATE TABLE IF NOT EXISTS store (key TEXT PRIMARY KEY, value TEXT)`)

// GET /api/members – return the saved members array
app.get('/api/members', (req, res) => {
  const row = db.prepare('SELECT value FROM store WHERE key = ?').get('members')
  res.json(row ? JSON.parse(row.value) : [])
})

// PUT /api/members – replace the entire members array
app.put('/api/members', (req, res) => {
  const members = req.body
  if (!Array.isArray(members)) return res.status(400).json({ error: 'Expected an array' })
  db.prepare('INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)').run(
    'members',
    JSON.stringify(members)
  )
  res.json({ ok: true, count: members.length })
})

// ── Google Sheets proxy (server-side fetch: no CORS, no JSONP, no URL limits) ─

// GET /api/sheets?url=<scriptUrl>&action=pull|status
app.get('/api/sheets', async (req, res) => {
  const { url, action = 'status' } = req.query
  if (!url) return res.status(400).json({ ok: false, error: 'url param required' })
  try {
    const r = await fetch(`${url}?action=${encodeURIComponent(action)}`)
    const json = await r.json()
    res.json(json)
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message })
  }
})

// POST /api/sheets/push  body: { url, data }
app.post('/api/sheets/push', async (req, res) => {
  const { url, data } = req.body
  if (!url || !data) return res.status(400).json({ ok: false, error: 'url and data required' })
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'push', data }),
    })
    const json = await r.json()
    res.json(json)
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message })
  }
})

app.listen(PORT, () => console.log(`Buchori API running on port ${PORT}`))
