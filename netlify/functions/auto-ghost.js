/**
 * Netlify Scheduled Function - Auto-ghost jobs
 *
 * Schedule: Run daily at 2 AM UTC
 *
 * To enable:
 * 1. Add to netlify.toml (see below)
 * 2. Deploy to Netlify
 * 3. Requires Netlify Pro plan for scheduled functions
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

export default async (req, context) => {
  console.log('Running auto-ghost job at', new Date().toISOString());

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  try {
    // Get jobs to ghost
    const { data: jobsToGhost, error: selectError } = await supabase
      .from('jobs')
      .select('id, company, title')
      .eq('status', 'awaiting')
      .lt('applied_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    if (selectError) throw selectError;

    if (!jobsToGhost || jobsToGhost.length === 0) {
      console.log('No jobs to ghost');
      return new Response(JSON.stringify({ ghosted: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Update them to ghosted
    const { error: updateError } = await supabase
      .from('jobs')
      .update({
        status: 'ghosted',
        outcome_notes: 'Auto-ghosted after 30 days no response'
      })
      .in('id', jobsToGhost.map(j => j.id));

    if (updateError) throw updateError;

    console.log(`✅ Ghosted ${jobsToGhost.length} jobs:`, jobsToGhost.map(j => `${j.company} - ${j.title}`));

    return new Response(JSON.stringify({
      ghosted: jobsToGhost.length,
      jobs: jobsToGhost
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Auto-ghost failed:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const config = {
  schedule: '0 2 * * *' // Run daily at 2 AM UTC
};
