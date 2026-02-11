import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { useAuth } from '@/contexts/AuthContext';
import type { FeatureFlags, UserRole } from '@/types';
import { Shield, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FeatureGateProps {
  feature: keyof FeatureFlags;
  children: React.ReactNode;
  moduleName: string;
  description?: string;
}

export function FeatureGate({ feature, children, moduleName, description }: FeatureGateProps) {
  const { isEnabled } = useFeatureFlags();
  const { hasRole } = useAuth();

  if (isEnabled(feature)) return <>{children}</>;

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6">
      <div className="relative mb-6">
        <div className="absolute inset-0 rounded-full bg-muted/30 blur-xl" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-border bg-card">
          <Lock className="h-10 w-10 text-muted-foreground" />
        </div>
      </div>
      <h2 className="mb-2 text-xl font-semibold text-foreground">{moduleName} — Module Disabled</h2>
      <p className="mb-6 max-w-lg text-center text-sm text-muted-foreground leading-relaxed">
        {description || `The ${moduleName} module is currently disabled. An administrator can enable this module from the Admin Panel → Feature Flags.`}
      </p>
      {hasRole(['admin']) && (
        <Button variant="outline" className="border-primary/30 text-primary hover:bg-primary/10">
          <Shield className="mr-2 h-4 w-4" />
          Enable in Admin Panel
        </Button>
      )}
    </div>
  );
}

interface RoleGateProps {
  roles: UserRole[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RoleGate({ roles, children, fallback }: RoleGateProps) {
  const { hasRole } = useAuth();
  if (hasRole(roles)) return <>{children}</>;
  return <>{fallback || null}</>;
}
