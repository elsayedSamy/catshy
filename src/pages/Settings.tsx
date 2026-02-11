import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { User, Key, Shield, Moon, Sun } from 'lucide-react';
import { useState } from 'react';

export default function Settings() {
  const { user } = useAuth();
  const [darkMode, setDarkMode] = useState(true);

  return (
    <div className="space-y-6 max-w-2xl">
      <div><h1 className="text-2xl font-bold">Settings</h1><p className="text-sm text-muted-foreground mt-1">Account and platform settings</p></div>

      <Card className="border-border bg-card">
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><User className="h-4 w-4 text-primary" />Profile</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Email</span><span className="text-sm font-medium">{user?.email || 'Not connected'}</span></div>
          <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Name</span><span className="text-sm font-medium">{user?.name || 'N/A'}</span></div>
          <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Role</span><Badge variant="outline" className="capitalize">{user?.role || 'N/A'}</Badge></div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Key className="h-4 w-4 text-primary" />Change Password</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input type="password" placeholder="Current password" className="bg-secondary/30" />
          <Input type="password" placeholder="New password" className="bg-secondary/30" />
          <Input type="password" placeholder="Confirm new password" className="bg-secondary/30" />
          <Button size="sm">Update Password</Button>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader><CardTitle className="flex items-center gap-2 text-base">{darkMode ? <Moon className="h-4 w-4 text-primary" /> : <Sun className="h-4 w-4 text-primary" />}Appearance</CardTitle></CardHeader>
        <CardContent>
          <Button variant="outline" size="sm" onClick={() => { setDarkMode(!darkMode); document.documentElement.classList.toggle('light', darkMode); }}>
            Switch to {darkMode ? 'Light' : 'Dark'} Mode
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Shield className="h-4 w-4 text-primary" />API Keys</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">API keys are managed via the FastAPI backend. Use the admin endpoint to create and revoke keys.</p>
          <code className="block rounded bg-secondary/30 p-3 text-xs font-mono text-muted-foreground">POST /api/admin/api-keys</code>
        </CardContent>
      </Card>
    </div>
  );
}
