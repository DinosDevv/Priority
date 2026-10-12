import { ActivityIndicator, Pressable, Text } from 'react-native';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
}

const STYLES = {
  primary: { box: 'bg-slate-100', text: 'text-slate-950' },
  secondary: { box: 'bg-slate-800', text: 'text-slate-100' },
  danger: { box: 'bg-rose-500/15', text: 'text-rose-400' },
};

export function Button({ label, onPress, variant = 'primary', disabled, loading }: Props) {
  const s = STYLES[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      className={`h-14 items-center justify-center rounded-2xl ${s.box} ${
        disabled || loading ? 'opacity-40' : 'active:opacity-80'
      }`}>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#020617' : '#f1f5f9'} />
      ) : (
        <Text className={`text-base font-semibold ${s.text}`}>{label}</Text>
      )}
    </Pressable>
  );
}
