import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { sendEmailCode, verifyEmailCode } from '@/lib/auth';
import { errorMessage } from '@/lib/format';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const sendCode = () =>
    run(async () => {
      await sendEmailCode(email.trim());
      setStep('code');
    });

  // On success the session changes and the root layout switches to the tabs.
  const verify = () => run(() => verifyEmailCode(email.trim(), code));

  return (
    <SafeAreaView className="flex-1 bg-slate-950">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-center gap-6 px-6">
        <View className="gap-2">
          <Text className="text-3xl font-bold text-slate-100">Priority</Text>
          <Text className="text-base text-slate-400">
            {step === 'email' ? 'Sign in with a code sent to your email.' : `Enter the 6-digit code sent to ${email.trim()}.`}
          </Text>
        </View>

        {step === 'email' ? (
          <>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor="#64748b"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              className="h-14 rounded-2xl bg-slate-800 px-4 text-base text-slate-100"
            />
            <Button label="Send code" onPress={sendCode} disabled={!email.includes('@')} loading={busy} />
          </>
        ) : (
          <>
            <TextInput
              value={code}
              onChangeText={(t) => setCode(t.replace(/[^0-9]/g, ''))}
              placeholder="123456"
              placeholderTextColor="#64748b"
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              className="h-14 rounded-2xl bg-slate-800 px-4 text-center text-2xl tracking-[8px] text-slate-100"
            />
            <Button label="Verify" onPress={verify} disabled={code.length !== 6} loading={busy} />
            <Pressable
              onPress={() => {
                setStep('email');
                setCode('');
                setError(null);
              }}>
              <Text className="text-center text-slate-400">Use a different email</Text>
            </Pressable>
          </>
        )}

        {error && <Text className="text-center text-rose-400">{error}</Text>}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
