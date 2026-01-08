import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

// Helper functions
export async function getJobs() {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .neq('status', 'rejected')  // Hide rejected/dismissed jobs
    .order('suitability', { ascending: false });

  if (error) throw error;
  return data;
}

export async function updateJobStatus(id: string, status: string | null) {
  const { error } = await supabase
    .from('jobs')
    .update({ status })
    .eq('id', id);

  if (error) throw error;
}

export async function deleteJob(id: string) {
  // Soft delete - mark as rejected so it won't resurface in future searches
  const { error } = await supabase
    .from('jobs')
    .update({ status: 'rejected' })
    .eq('id', id);

  if (error) throw error;
}

export async function upsertJobs(jobs: any[]) {
  const { error } = await supabase
    .from('jobs')
    .upsert(jobs, {
      onConflict: 'id',
      ignoreDuplicates: false
    });

  if (error) throw error;
}

export function generateJobId(job: { source?: string; company: string; title: string }): string {
  const normalise = (str: string) =>
    str.toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 30);

  return `${normalise(job.source || 'manual')}-${normalise(job.company)}-${normalise(job.title)}`;
}
