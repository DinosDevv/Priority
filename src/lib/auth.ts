import { clearReminderNotifications } from './notifications';
import { supabase } from './supabase';

export async function sendEmailCode(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) throw error;
}

export async function verifyEmailCode(email: string, token: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  await clearReminderNotifications().catch(() => {});
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
