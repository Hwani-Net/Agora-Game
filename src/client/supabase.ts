/**
 * supabase.ts — Supabase Client
 * ==============================
 * Singleton client for Supabase (DB + Auth).
 */

import { createClient } from '@supabase/supabase-js';

// @ts-expect-error Vite injects import.meta.env at build time
const SUPABASE_URL: string = import.meta.env?.VITE_SUPABASE_URL || '';
// @ts-expect-error Vite injects import.meta.env at build time
const SUPABASE_ANON_KEY: string = import.meta.env?.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('⚠️ Supabase 환경변수가 설정되지 않았습니다. VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY를 확인하세요.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
