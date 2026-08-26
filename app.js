const fmt = (value, digits = 1) => {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(digits)}%` : '—';
};
const fmtPlain = (value, digits = 1) => {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(digits) : '—';
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
const median = (values) => {
  const nums = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!nums.length) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
};
const average = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);
const normMonthly = (medianValue, baselineMaxDdPct) => {
  const dd = Number(baselineMaxDdPct);
  return Number.isFinite(medianValue) && Number.isFinite(dd) && dd > 0 ? medianValue * (20 / dd) : null;
};

function miniBars(signal) {
  const rows = monthlyRows(signal);
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
  return `<article class="card" role="button" tabindex="0" data-signal-id="${esc(signal.id)}" aria-label="Open details for ${esc(signal.name)}"><div class="top"><img class="avatar" src="${esc(signal.avatar_url || '')}" alt=""><div class="title"><h2>${esc(signal.name)}</h2><div class="provider">${esc(signal.provider || '—')}</div><div class="badges">${badge('priority', signal.priority)}${badge('role', signal.role)}</div></div><div class="status">${esc((signal.status || 'WATCH').split('/')[0].trim())}</div></div>${metricGrid(signal)}<div class="fingerprint">${esc(signal.risk_fingerprint || '')}</div><div class="months">${miniBars(signal)}</div><div class="foot"><span>T0 ${esc(signal.t0_date || '2026-08-26')}</span><span>${signal.price_monthly_usd ? `$${esc(signal.price_monthly_usd)}/mo` : ''}</span></div></article>`;
}

function periodSummary(signal, periodType) {
  const values = monthlyRows(signal)
    .filter((row) => row.period_type === periodType && isValidReturn(row))
    .map((row) => Number(row.return_pct));

  if (!values.length) {
    return { months: 0, median: null, average: null, positivePct: null, best: null, worst: null, norm: null };
  }

  const medianValue = median(values);
  return {
    months: values.length,
    median: medianValue,
    average: average(values),
    positivePct: (values.filter((value) => value > 0).length / values.length) * 100,
    best: Math.max(...values),
    worst: Math.min(...values),
    norm: normMonthly(medianValue, signal.baseline_max_dd_pct)
  };
}

function summaryPanel(title, summary) {
  const empty = summary.months === 0;
  return `<section class="summary-panel"><div class="summary-title">${title}</div>${empty ? '<p class="no-data">No data yet</p>' : ''}<div class="summary-grid"><div><span>Months</span><b>${summary.months}</b></div><div><span>Median/mo</span><b>${fmt(summary.median)}</b></div><div><span>Average/mo</span><b>${fmt(summary.average)}</b></div><div><span>Positive months</span><b>${fmt(summary.positivePct, 0)}</b></div><div><span>Best month</span><b>${fmt(summary.best)}</b></div><div><span>Worst month</span><b>${fmt(summary.worst)}</b></div><div class="summary-wide"><span>${title === 'BASELINE' ? 'Baseline' : 'Forward'} NORM/MO</span><b>${fmt(summary.norm)}</b></div></div></section>`;
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

function detailView(signal) {
  const baseline = periodSummary(signal, 'historical');
  const forward = periodSummary(signal, 'forward');
  return `<div class="modal-backdrop" data-close-detail></div><section class="detail-modal" role="dialog" aria-modal="true" aria-label="${esc(signal.name)} detail view"><button class="close-detail" type="button" data-close-detail aria-label="Close detail view">&times;</button><div class="detail-header"><div class="detail-topline"><img class="avatar detail-avatar" src="${esc(signal.avatar_url || '')}" alt=""><div class="title"><h2>${esc(signal.name)}</h2><div class="provider">${esc(signal.provider || '—')}</div><div class="badges">${badge('priority', signal.priority)}${badge('role', signal.role)}</div></div></div><div class="detail-t0"><span>T0 baseline</span><b>${esc(signal.t0_date || '2026-08-26')}</b></div></div>${metricGrid(signal)}<div class="fingerprint detail-fingerprint">${esc(signal.risk_fingerprint || '')}</div>${monthlyChart(signal)}<section class="detail-section"><div class="summary-panels">${summaryPanel('BASELINE', baseline)}${summaryPanel('FORWARD', forward)}</div><p class="norm-note">Linear 20% DD scaling approximation: median monthly return x (20 / baseline max DD).</p></section></section>`;
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
