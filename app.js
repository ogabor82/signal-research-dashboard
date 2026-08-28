const fmt = (value, digits = 1) => {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(digits)}%` : '—';
};
const fmtPlain = (value, digits = 1) => {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(digits) : '—';
};
const fmtSmartPct = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${Number.isInteger(n) ? n.toFixed(0) : n.toFixed(1)}%`;
};
const fmtMoney = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? `$${Math.round(n).toLocaleString('en-US')}` : '—';
};
const months = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
let signals = [];

const esc = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
const badgeClass = (type, value) =>
  `${type}-${String(value || 'unknown').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'unknown'}`;
const badge = (type, value) =>
  value ? `<span class="badge ${type} ${badgeClass(type, value)}">${esc(value)}</span>` : '';
const isValidReturn = (row) =>
  row && row.return_pct != null && row.return_pct !== '' && Number.isFinite(Number(row.return_pct));
const monthlyRows = (signal) =>
  [...(signal.monthly_returns || [])].sort((a, b) => Number(a.year) - Number(b.year) || Number(a.month) - Number(b.month));
const toTime = (value) => {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
};
const formatDateLabel = (value) => {
  const time = toTime(value);
  if (time === null) return '—';
  const date = new Date(time);
  return `${monthNames[date.getUTCMonth()]} ${date.getUTCDate()}`;
};
const dateKey = (value) => {
  const time = toTime(value);
  return time === null ? '' : new Date(time).toISOString().slice(0, 10);
};
const snapshotRows = (signal) => {
  const rows = signal.snapshots?.length ? signal.snapshots : signal.latest_snapshot ? [signal.latest_snapshot] : [];
  return [...rows].sort((a, b) => (toTime(a.captured_at) || 0) - (toTime(b.captured_at) || 0));
};
function miniBars(signal) {
  const rows = monthlyRows(signal).slice(-16);
  const values = rows.filter(isValidReturn).map((row) => Number(row.return_pct));
  const max = Math.max(1, ...values.map(Math.abs));

  return rows
    .map((row) => {
      const value = Number(row.return_pct);
      const safe = isValidReturn(row);
      const height = safe ? Math.max(2, Math.min(55, (Math.abs(value) / max) * 55)) : 2;
      return `<div class="m" title="${esc(row.year)}-${String(row.month).padStart(2, '0')}: ${safe ? `${value}%` : '—'}"><div class="barwrap"><div class="bar ${safe && value < 0 ? 'neg' : ''}" style="height:${height}px"></div></div><div class="mval">${safe ? `${value > 0 ? '+' : ''}${value.toFixed(1)}` : '—'}</div><div class="mlabel">${months[row.month - 1] || '?'}${String(row.year).slice(2)}</div></div>`;
    })
    .join('');
}

function metricGrid(signal) {
  return `<div class="metrics"><div class="metric"><b>${fmt(signal.baseline_growth_pct)}</b><span>Growth</span></div><div class="metric"><b>${fmt(signal.baseline_max_dd_pct)}</b><span>Max DD</span></div><div class="metric" title="2026 median monthly return scaled linearly to 20% max DD"><b>${fmt(signal.normalized_monthly_20dd_pct)}</b><span>NORM/MO</span></div><div class="metric"><b>${fmt(signal.baseline_win_rate_pct)}</b><span>Win rate</span></div><div class="metric"><b>${fmt(signal.baseline_deposit_load_pct)}</b><span>Load</span></div></div>`;
}

function card(signal) {
  return `<article class="card" role="button" tabindex="0" data-signal-id="${esc(signal.id)}" aria-label="Open details for ${esc(signal.name)}"><div class="top"><img class="avatar" src="${esc(signal.avatar_url || '')}" alt=""><div class="title"><h2>${esc(signal.name)}</h2><div class="provider">${esc(signal.provider || '—')}</div><div class="badges">${badge('priority', signal.priority)}${badge('role', signal.role)}</div></div><div class="status">${esc((signal.status || 'WATCH').split('/')[0].trim())}</div></div>${metricGrid(signal)}<div class="fingerprint">${esc(signal.risk_fingerprint || '')}</div><div class="mini-chart-label">Last 16 months</div><div class="months">${miniBars(signal)}</div><div class="foot"><span>T0 ${esc(signal.t0_date || '2026-08-26')}</span><span>${signal.price_monthly_usd ? `$${esc(signal.price_monthly_usd)}/mo` : ''}</span></div></article>`;
}

function chartBar(row, max) {
  const value = Number(row.return_pct);
  const safe = isValidReturn(row);
  const period = row.period_type === 'forward' ? 'forward' : 'historical';
  const height = safe ? Math.max(8, Math.min(180, (Math.abs(value) / max) * 180)) : 8;
  const label = `${monthNames[row.month - 1] || '?'} ${row.year}`;
  return `<div class="detail-month period-${period} ${safe && value < 0 ? 'neg' : 'pos'}"><div class="detail-bar-space"><div class="detail-bar" style="height:${height}px"></div></div><div class="detail-value">${safe ? `${value > 0 ? '+' : ''}${fmtPlain(value)}%` : '—'}</div><div class="detail-label">${esc(label)}</div><div class="period-label">${period}</div></div>`;
}

function monthlyChart(signal) {
  const rows = monthlyRows(signal);
  const values = rows.filter(isValidReturn).map((row) => Number(row.return_pct));
  const max = Math.max(1, ...values.map(Math.abs));
  const hasForward = rows.some((row) => row.period_type === 'forward');
  let markerAdded = false;
  const bars = rows
    .map((row) => {
      const html = chartBar(row, max);
      if (!markerAdded && Number(row.year) === 2026 && Number(row.month) === 8) {
        markerAdded = true;
        return `${html}<div class="t0-marker"><span>T0 = 2026-08-26</span></div>`;
      }
      return html;
    })
    .join('');
  const marker = markerAdded ? '' : '<div class="t0-marker standalone"><span>T0 = 2026-08-26</span></div>';

  return `<section class="detail-section monthly-performance"><div class="section-head"><h3>Monthly Performance</h3><div class="legend"><span class="legend-historical">Historical</span><span class="legend-forward">Forward</span><span class="legend-negative">Negative</span></div></div><div class="detail-chart">${bars}${marker}</div>${hasForward ? '' : '<div class="forward-empty">No forward months yet</div>'}</section>`;
}

function trend(value, previous) {
  const current = Number(value);
  const prior = Number(previous);
  if (!Number.isFinite(current) || !Number.isFinite(prior)) return '';
  if (current > prior) return '<span class="trend up">↑</span>';
  if (current < prior) return '<span class="trend down">↓</span>';
  return '<span class="trend flat">→</span>';
}

function snapshotCell(value, previous, type = 'pct') {
  const formatted = type === 'money' ? fmtMoney(value) : fmtSmartPct(value);
  return `${formatted}${trend(value, previous)}`;
}

function monitoringSnapshots(signal) {
  const t0Date = signal.t0_date || '2026-08-26';
  const t0Key = dateKey(t0Date);
  const snapshots = snapshotRows(signal);
  const baselineSnapshot = snapshots.filter((row) => t0Key && dateKey(row.captured_at) <= t0Key).at(-1) || null;
  const rows = [
    {
      label: `T0 &middot; ${formatDateLabel(t0Date)}`,
      growth: signal.baseline_growth_pct,
      equity: baselineSnapshot?.equity ?? baselineSnapshot?.balance,
      maxDd: signal.baseline_max_dd_pct,
      load: signal.baseline_deposit_load_pct,
      winRate: signal.baseline_win_rate_pct,
      algo: signal.baseline_algo_pct
    },
    ...snapshots
      .filter((row) => !t0Key || dateKey(row.captured_at) > t0Key)
      .map((row) => ({
        label: formatDateLabel(row.captured_at),
        growth: row.growth_pct,
        equity: row.equity ?? row.balance,
        maxDd: row.max_dd_pct,
        load: row.deposit_load_pct,
        winRate: row.win_rate_pct,
        algo: row.algo_pct
      }))
  ];
  const body = rows
    .map((row, index) => {
      const previous = rows[index - 1] || {};
      return `<tr><th>${row.label}</th><td>${snapshotCell(row.growth, previous.growth)}</td><td>${snapshotCell(row.equity, previous.equity, 'money')}</td><td>${snapshotCell(row.maxDd, previous.maxDd)}</td><td>${snapshotCell(row.load, previous.load)}</td><td>${snapshotCell(row.winRate, previous.winRate)}</td><td>${snapshotCell(row.algo, previous.algo)}</td></tr>`;
    })
    .join('');
  const empty = rows.length === 1 ? '<p class="snapshot-empty">No monitoring snapshots yet</p>' : '';

  return `<section class="detail-section monitoring-section"><h3><code>Monitoring snapshots</code></h3><div class="snapshot-table-wrap"><table class="snapshot-table"><thead><tr><th>Date</th><th>Growth</th><th>Equity</th><th>Max DD</th><th>Load</th><th>Win rate</th><th>Algo</th></tr></thead><tbody>${body}</tbody></table></div>${empty}</section>`;
}

function detailView(signal) {
  return `<div class="modal-backdrop" data-close-detail></div><section class="detail-modal" role="dialog" aria-modal="true" aria-label="${esc(signal.name)} detail view"><button class="close-detail" type="button" data-close-detail aria-label="Close detail view">&times;</button><div class="detail-header"><div class="detail-topline"><img class="avatar detail-avatar" src="${esc(signal.avatar_url || '')}" alt=""><div class="title"><h2>${esc(signal.name)}</h2><div class="provider">${esc(signal.provider || '—')}</div><div class="badges">${badge('priority', signal.priority)}${badge('role', signal.role)}</div></div></div><div class="detail-t0"><span>T0 baseline</span><b>${esc(signal.t0_date || '2026-08-26')}</b></div></div>${metricGrid(signal)}<div class="fingerprint detail-fingerprint">${esc(signal.risk_fingerprint || '')}</div>${monthlyChart(signal)}${monitoringSnapshots(signal)}</section>`;
}

function openDetail(id) {
  const signal = signals.find((item) => String(item.id) === String(id));
  if (!signal) return;
  const mount = document.getElementById('detail-root');
  mount.innerHTML = detailView(signal);
  document.body.classList.add('detail-open');
  mount.querySelector('.close-detail').focus();
}

function closeDetail() {
  document.getElementById('detail-root').innerHTML = '';
  document.body.classList.remove('detail-open');
}

function bindDashboard() {
  document.getElementById('app').addEventListener('click', (event) => {
    const cardEl = event.target.closest('.card[data-signal-id]');
    if (cardEl) openDetail(cardEl.dataset.signalId);
  });
  document.getElementById('app').addEventListener('keydown', (event) => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('.card[data-signal-id]')) {
      event.preventDefault();
      openDetail(event.target.dataset.signalId);
    }
  });
  document.getElementById('detail-root').addEventListener('click', (event) => {
    if (event.target.matches('[data-close-detail]')) closeDetail();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && document.body.classList.contains('detail-open')) closeDetail();
  });
}

fetch('/api/signals')
  .then((response) => response.json())
  .then((payload) => {
    if (payload.error) throw new Error(payload.error);
    signals = payload.signals || [];
    document.body.insertAdjacentHTML('beforeend', '<div id="detail-root"></div>');
    bindDashboard();
    document.getElementById('count').textContent = `${signals.length} baselines`;
    document.getElementById('app').innerHTML = `<div class="grid">${signals.map(card).join('')}</div>`;
  })
  .catch((error) => {
    document.getElementById('app').innerHTML = `<div class="error">${esc(error.message)}</div>`;
  });
