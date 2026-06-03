import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const mode = (process.env.BRREG_USE_DB ?? 'auto').trim().toLowerCase();
console.log('BRREG_USE_DB:', JSON.stringify(process.env.BRREG_USE_DB));
console.log('mode:', mode);
console.log('BRREG_LIVE:', process.env.NEXT_PUBLIC_BRREG_LIVE);
console.log('DEMO:', process.env.NEXT_PUBLIC_DEMO_MODE);
if (!url || !key) { console.error('Missing supabase'); process.exit(1); }
const sb = createClient(url, key);
const t0 = Date.now();
const { count, error } = await sb.from('companies').select('*', { count: 'exact', head: true });
console.log('count:', count, 'ms:', Date.now()-t0, error?.message || '');
const useDb = mode === 'true' || mode === '1' || mode === 'yes' || ((mode === 'auto' || !['false','0','no'].includes(mode)) && (count ?? 0) >= 10000);
console.log('shouldUseDb:', useDb);
