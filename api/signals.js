const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function sb(path) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variable');
  }

  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Accept: 'application/json'
    }
  });

  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  return r.json();
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function median(values) {
  const nums = values
    .map(toNumber)
    .filter((value) => value !== null)
    .sort((a, b) => a - b);

  if (nums.length === 0) return null;

  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 === 0 ? (nums[mid - 1] + nums[mid]) / 2 : nums[mid];
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const [signals, monthly, snapshots] = await Promise.all([
      sb('signals?select=id,name,provider,t0_date,baseline_growth_pct,baseline_max_dd_pct,baseline_pf,baseline_win_rate_pct,baseline_deposit_load_pct,baseline_algo_pct,price_monthly_usd,category,status,priority,role,risk_fingerprint,avatar_url&order=id.asc'),
      sb('signal_monthly_returns?select=signal_id,year,month,return_pct,period_type,notes&order=year.asc,month.asc'),
      sb('signal_snapshots?select=signal_id,captured_at,growth_pct,balance,equity,max_dd_pct,current_dd_pct,deposit_load_pct,pf,win_rate_pct,trades,algo_pct,subscribers,subscriber_funds,price_monthly_usd,status&order=captured_at.desc')
    ]);

    const data = signals.map((s) => {
      const monthlyReturns = monthly.filter((m) => m.signal_id === s.id);
      const signalSnapshots = snapshots.filter((x) => x.signal_id === s.id);
      const medianMonthly2026Pct = median(
        monthlyReturns
          .filter((m) => Number(m.year) === 2026)
          .map((m) => m.return_pct)
      );
      const baselineMaxDdPct = toNumber(s.baseline_max_dd_pct);
      const normalizedMonthly20DdPct =
        medianMonthly2026Pct !== null && baselineMaxDdPct !== null && baselineMaxDdPct > 0
          ? medianMonthly2026Pct * (20 / baselineMaxDdPct)
          : null;

      return {
        ...s,
        monthly_returns: monthlyReturns,
        snapshots: signalSnapshots,
        latest_snapshot: signalSnapshots[0] || null,
        median_monthly_2026_pct: medianMonthly2026Pct,
        normalized_monthly_20dd_pct: normalizedMonthly20DdPct
      };
    });

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json({ signals: data, generated_at: new Date().toISOString() });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
