import {createClient} from '@supabase/supabase-js';
const url=import.meta.env.VITE_SUPABASE_URL;const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const cloud=url&&key?createClient(url,key):null;
export async function saveWorkspace(user,data){const {error}=await cloud.from('projection_workspaces').upsert({user_id:user.id,data,updated_at:new Date().toISOString()},{onConflict:'user_id'});if(error)throw error;}
export async function loadWorkspace(user){const {data,error}=await cloud.from('projection_workspaces').select('data').eq('user_id',user.id).maybeSingle();if(error)throw error;return data?.data;}
