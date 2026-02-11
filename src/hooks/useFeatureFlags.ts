import { useState } from 'react';
import { DEFAULT_FEATURE_FLAGS, type FeatureFlags } from '@/types';

export function useFeatureFlags() {
  const [flags] = useState<FeatureFlags>(() => {
    try {
      const stored = localStorage.getItem('catshy_feature_flags');
      if (stored) return { ...DEFAULT_FEATURE_FLAGS, ...JSON.parse(stored) };
    } catch {}
    return DEFAULT_FEATURE_FLAGS;
  });

  const isEnabled = (flag: keyof FeatureFlags) => flags[flag];

  const setFlag = (flag: keyof FeatureFlags, value: boolean) => {
    const updated = { ...flags, [flag]: value };
    localStorage.setItem('catshy_feature_flags', JSON.stringify(updated));
    window.location.reload();
  };

  return { flags, isEnabled, setFlag };
}
