# Signal Research Dashboard

Minimal Vercel dashboard for the Signal Research Lab.

## Supabase tables

- `signals`
- `signal_monthly_returns`
- `signal_snapshots`

## Deploy to Vercel

1. Upload/push these files to the GitHub repository.
2. Import the repository in Vercel.
3. In **Project Settings → Environment Variables**, add:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
4. Deploy.

Use the Supabase project URL and its **publishable/anon key**. Do not use a service-role key.

## Security

The dashboard only performs SELECT queries. Keep Supabase RLS enabled with anon SELECT policies only; do not grant anonymous insert/update/delete.
