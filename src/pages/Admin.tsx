import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { RoleGate } from '@/components/FeatureGate';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Shield, Users, Activity, Flag, Clock, AlertTriangle } from 'lucide-react';
import type { FeatureFlags } from '@/types';

const featureFlagLabels: Record<keyof FeatureFlags, { label: string; description: string }> = {
  graph_explorer: { label: 'Graph Explorer', description: 'Interactive entity-relationship visualization' },
  risk_scoring: { label: 'Risk & Confidence Scoring', description: 'Multi-factor scoring with explainability' },
  alerts_rules: { label: 'Alerts & Rules', description: 'Detection rules and alert notifications' },
  investigations: { label: 'Investigations', description: 'Notebook workspace for threat analysis' },
  cases_reports: { label: 'Cases & Reports', description: 'Case management and report generation' },
  leaks_center: { label: 'Leaks Center', description: 'Credential and breach monitoring' },
  leaks_tor: { label: 'TOR Connectors', description: 'Dark web monitoring via TOR (requires legal review)' },
  threat_map_3d: { label: '3D Threat Map', description: 'Three.js globe visualization' },
  playbooks: { label: 'Playbooks', description: 'Low-code automation engine' },
  integrations_marketplace: { label: 'Integrations Marketplace', description: 'Third-party connector marketplace' },
};

export default function Admin() {
  const { hasRole } = useAuth();
  const { flags, setFlag } = useFeatureFlags();
  const [torWarning, setTorWarning] = useState(false);

  if (!hasRole(['admin'])) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center">
        <Shield className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
        <p className="text-sm text-muted-foreground">The Admin Panel requires administrator privileges.</p>
      </div>
    );
  }

  const handleTorToggle = (enabled: boolean) => {
    if (enabled) { setTorWarning(true); return; }
    setFlag('leaks_tor', false);
  };

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Admin Panel</h1><p className="text-sm text-muted-foreground mt-1">System administration and configuration</p></div>
      <Tabs defaultValue="flags">
        <TabsList className="bg-secondary/50 border border-border">
          <TabsTrigger value="flags" className="text-xs"><Flag className="mr-1 h-3 w-3" />Feature Flags</TabsTrigger>
          <TabsTrigger value="users" className="text-xs"><Users className="mr-1 h-3 w-3" />Users</TabsTrigger>
          <TabsTrigger value="audit" className="text-xs"><Clock className="mr-1 h-3 w-3" />Audit Log</TabsTrigger>
          <TabsTrigger value="system" className="text-xs"><Activity className="mr-1 h-3 w-3" />System</TabsTrigger>
        </TabsList>

        <TabsContent value="flags" className="mt-4 space-y-3">
          {(Object.keys(featureFlagLabels) as (keyof FeatureFlags)[]).map(key => (
            <Card key={key} className={`border-border bg-card ${key === 'leaks_tor' ? 'border-l-2 border-l-warning' : ''}`}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{featureFlagLabels[key].label}</p>
                    {key === 'leaks_tor' && <Badge className="bg-warning/20 text-warning text-xs">Sensitive</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{featureFlagLabels[key].description}</p>
                </div>
                <Switch checked={flags[key]} onCheckedChange={v => key === 'leaks_tor' ? handleTorToggle(v) : setFlag(key, v)} />
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <Card className="border-border bg-card"><CardContent className="p-6 text-center text-sm text-muted-foreground">
            User management connects to the FastAPI backend. Configure users via the API or the admin bootstrap script.
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <Card className="border-border bg-card"><CardContent className="p-6 text-center text-sm text-muted-foreground">
            Audit logs are stored in PostgreSQL and queryable via the API. All user actions, source changes, and exports are logged.
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="system" className="mt-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'API Server', status: 'Connect backend', icon: Activity },
              { label: 'PostgreSQL', status: 'Connect backend', icon: Activity },
              { label: 'Redis', status: 'Connect backend', icon: Activity },
              { label: 'Celery Workers', status: 'Connect backend', icon: Activity },
            ].map(s => (
              <Card key={s.label} className="border-border bg-card">
                <CardContent className="p-4 text-center">
                  <s.icon className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                  <p className="font-medium text-sm">{s.label}</p>
                  <p className="text-xs text-muted-foreground">{s.status}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* TOR Warning Dialog */}
      {torWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <Card className="max-w-md border-warning/30 bg-card">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3"><AlertTriangle className="h-6 w-6 text-warning" /><h3 className="text-lg font-semibold">Enable TOR Connectors</h3></div>
              <p className="text-sm text-muted-foreground">Enabling TOR dark web monitoring may have legal implications depending on your jurisdiction. This action is audit-logged and only available to administrators.</p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                <li>All TOR connector activity is logged in the audit trail</li>
                <li>Ensure compliance with your organization's security policies</li>
                <li>This feature can be disabled at any time</li>
              </ul>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setTorWarning(false)}>Cancel</Button>
                <Button className="bg-warning text-warning-foreground hover:bg-warning/90" onClick={() => { setFlag('leaks_tor', true); setTorWarning(false); }}>
                  I Understand — Enable TOR
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
