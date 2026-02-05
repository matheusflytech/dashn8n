import './style.css'

const app = document.querySelector('#app')

const state = {
  rows: [],
  lastUpdated: null,
  error: null,
}

function esc(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function moneyBRL(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '0,00'
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function parseDate(v) {
  if (!v) return null
  if (typeof v === 'string' && /^\d{2}\/\d{2}\/\d{4}/.test(v)) {
    const [dmy, hms='00:00:00'] = v.split(' ')
    const [dd, mm, yyyy] = dmy.split('/').map(Number)
    const [hh, mi, ss] = hms.split(':').map(Number)
    const dt = new Date(yyyy, (mm-1), dd, hh||0, mi||0, ss||0)
    return Number.isFinite(dt.getTime()) ? dt : null
  }
  const dt = new Date(v)
  return Number.isFinite(dt.getTime()) ? dt : null
}

function groupBy(arr, keyFn) {
  const m = new Map()
  for (const x of arr) {
    const k = keyFn(x)
    m.set(k, (m.get(k) || 0) + 1)
  }
  return [...m.entries()].sort((a,b) => b[1] - a[1])
}

function sum(arr, key) {
  return arr.reduce((acc, r) => acc + (Number(r?.[key]) || 0), 0)
}

function render() {
  const url = import.meta.env.VITE_SALES_API_URL

  const total = sum(state.rows, 'value')
  const count = state.rows.length

  const byOffer = groupBy(state.rows, r => r.offer_code || '(sem offer)').slice(0, 10)
  const bySck = groupBy(state.rows, r => r.sck || '(sem sck)').slice(0, 10)

  const rowsHtml = state.rows.slice(0, 200).map(r => `
    <tr>
      <td class="mono">${esc(r.transaction)}</td>
      <td>${esc(r.approved_date || r.order_date || '')}</td>
      <td>${esc(r.offer_code || '')}</td>
      <td>${esc(r.product_name || '')}</td>
      <td>${esc(r.buyer_email || '')}</td>
      <td class="num">R$ ${moneyBRL(r.value)}</td>
      <td>${esc(r.src || '')}</td>
      <td>${esc(r.sck || '')}</td>
    </tr>
  `).join('')

  app.innerHTML = `
    <div class="container">
      <header class="topbar">
        <div>
          <div class="title">Dashboard n8n</div>
          <div class="subtitle">Vendas (GET) via n8n</div>
        </div>
        <div class="right">
          <button class="btn" id="btnRefresh">Atualizar</button>
        </div>
      </header>

      <section class="cards">
        <div class="card">
          <div class="k">Endpoint</div>
          <div class="v mono">${esc(url || '(defina VITE_SALES_API_URL no Vercel)')}</div>
        </div>
        <div class="card">
          <div class="k">Total (R$)</div>
          <div class="v">R$ ${moneyBRL(total)}</div>
        </div>
        <div class="card">
          <div class="k">Transações</div>
          <div class="v">${count}</div>
        </div>
        <div class="card">
          <div class="k">Última atualização</div>
          <div class="v">${state.lastUpdated ? esc(state.lastUpdated.toLocaleString('pt-BR')) : '-'}</div>
        </div>
      </section>

      ${state.error ? `<div class="alert">Erro: <span class="mono">${esc(state.error)}</span></div>` : ''}

      <section class="grid2">
        <div class="panel">
          <div class="panelTitle">Top offers (por contagem)</div>
          <ul class="list">
            ${byOffer.map(([k, v]) => `<li><span class="mono">${esc(k)}</span><span class="pill">${v}</span></li>`).join('')}
          </ul>
        </div>
        <div class="panel">
          <div class="panelTitle">Top SCK (por contagem)</div>
          <ul class="list">
            ${bySck.map(([k, v]) => `<li><span class="mono">${esc(k)}</span><span class="pill">${v}</span></li>`).join('')}
          </ul>
        </div>
      </section>

      <section class="panel">
        <div class="panelTitle">Últimas linhas (até 200)</div>
        <div class="hint">A UI limita a 200 para ficar leve.</div>
        <div class="tableWrap">
          <table>
            <thead>
              <tr>
                <th>transaction</th>
                <th>approved/order</th>
                <th>offer</th>
                <th>produto</th>
                <th>email</th>
                <th class="num">valor</th>
                <th>src</th>
                <th>sck</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
      </section>

      <footer class="footer">
        <span>Sem Lovable / sem ícones externos.</span>
      </footer>
    </div>
  `

  document.getElementById('btnRefresh')?.addEventListener('click', () => load())
}

async function load() {
  state.error = null
  const url = import.meta.env.VITE_SALES_API_URL

  if (!url) {
    state.rows = []
    state.lastUpdated = new Date()
    state.error = 'VITE_SALES_API_URL não definido'
    render()
    return
  }

  try {
    const res = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' }, cache: 'no-store' })
    if (!res.ok) {
      const t = await res.text().catch(() => '')
      throw new Error(`HTTP ${res.status} ${res.statusText}${t ? ' - ' + t.slice(0, 200) : ''}`)
    }

    const data = await res.json()
    const rows =
      Array.isArray(data) ? data :
      Array.isArray(data?.rows) ? data.rows :
      Array.isArray(data?.data) ? data.data :
      Array.isArray(data?.json) ? data.json :
      []

    const normalized = rows.map(r => ({ ...r, value: Number(r?.value) || 0 }))

    normalized.sort((a, b) => {
      const da = parseDate(a.approved_date || a.order_date) || new Date(0)
      const db = parseDate(b.approved_date || b.order_date) || new Date(0)
      return db - da
    })

    state.rows = normalized
    state.lastUpdated = new Date()
    render()
  } catch (e) {
    state.rows = []
    state.lastUpdated = new Date()
    state.error = e?.message || String(e)
    render()
  }
}

render()
load()
