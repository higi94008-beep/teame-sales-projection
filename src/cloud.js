import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const cloud = url && key ? createClient(url, key) : null;

export async function loadSavedMaster(user) {
  const { data, error } = await cloud
    .from('projection_masters')
    .select('data, filename, updated_at')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    rows: Array.isArray(data.data) ? data.data : [],
    filename: data.filename || 'Saved master',
    updatedAt: data.updated_at
  };
}

export async function saveMaster(user, rows, filename) {
  const { error } = await cloud
    .from('projection_masters')
    .upsert({
      user_id: user.id,
      data: rows,
      filename,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });
  if (error) throw error;
}
