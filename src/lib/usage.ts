import { SupabaseClient } from '@supabase/supabase-js';

export async function getMonthlyUsage(
  userId: string,
  supabase: SupabaseClient
): Promise<number> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from('ai_usage')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', startOfMonth.toISOString());

  if (error) return 0;
  return count ?? 0;
}

export async function getUserPlan(
  userId: string,
  supabase: SupabaseClient
): Promise<{ plan: string; monthly_limit: number }> {
  const { data, error } = await supabase
    .from('user_plans')
    .select('plan, monthly_limit')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return { plan: 'free', monthly_limit: 20 };
  }
  return data;
}

export async function canUseAI(
  userId: string,
  supabase: SupabaseClient
): Promise<boolean> {
  const [usage, plan] = await Promise.all([
    getMonthlyUsage(userId, supabase),
    getUserPlan(userId, supabase),
  ]);

  if (plan.plan === 'pro') return true;
  return usage < plan.monthly_limit;
}

export async function incrementUsage(
  userId: string,
  feature: string,
  supabase: SupabaseClient
): Promise<void> {
  await supabase.from('ai_usage').insert({
    user_id: userId,
    feature,
  });
}
