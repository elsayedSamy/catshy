import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Pencil, Trash2, Search, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState } from '@/components/EmptyState';
import { SeverityBadge } from '@/components/StatusBadge';
import { useAssets, useCreateAsset, useDeleteAsset } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import type { Asset, AssetType, CriticalityTier } from '@/types';

const assetTabs: { type: AssetType; label: string }[] = [
  { type: 'domain', label: 'Domains' }, { type: 'ip_range', label: 'IP Ranges' },
  { type: 'asn', label: 'ASNs' }, { type: 'brand', label: 'Brands / Keywords' },
  { type: 'email_domain', label: 'Email Domains' }, { type: 'app', label: 'Applications' },
  { type: 'subsidiary', label: 'Subsidiaries' },
];

const criticalityMap: Record<CriticalityTier, string> = {
  critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low', info: 'Info',
};

export default function Assets() {
  const { data: apiAssets } = useAssets();
  const [localAssets, setLocalAssets] = useState<Asset[]>([]);
  const assets = apiAssets ?? localAssets;

  const createMutation = useCreateAsset();
  const deleteMutation = useDeleteAsset();

  const [activeTab, setActiveTab] = useState<AssetType>('domain');
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [formValue, setFormValue] = useState('');
  const [formLabel, setFormLabel] = useState('');
  const [formCriticality, setFormCriticality] = useState<CriticalityTier>('medium');
  const [formTags, setFormTags] = useState('');

  const filtered = assets.filter(a =>
    a.type === activeTab &&
    (searchQuery === '' || a.value.toLowerCase().includes(searchQuery.toLowerCase()) || a.label.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const openAdd = () => { setEditingAsset(null); setFormValue(''); setFormLabel(''); setFormCriticality('medium'); setFormTags(''); setDialogOpen(true); };
  const openEdit = (asset: Asset) => { setEditingAsset(asset); setFormValue(asset.value); setFormLabel(asset.label); setFormCriticality(asset.criticality); setFormTags(asset.tags.join(', ')); setDialogOpen(true); };

  const handleSave = () => {
    const now = new Date().toISOString();
    const tags = formTags.split(',').map(t => t.trim()).filter(Boolean);
    if (editingAsset) {
      setLocalAssets(prev => prev.map(a => a.id === editingAsset.id ? { ...a, value: formValue, label: formLabel, criticality: formCriticality, tags, updated_at: now } : a));
      toast.success('Asset updated');
    } else {
      const newAsset: Asset = { id: crypto.randomUUID(), type: activeTab, value: formValue, label: formLabel || formValue, criticality: formCriticality, tags, notes: '', created_at: now, updated_at: now };
      if (api.getDevMode()) {
        setLocalAssets(prev => [...prev, newAsset]);
        toast.success('Asset added (local)');
      } else {
        createMutation.mutate({ type: activeTab, value: formValue, label: formLabel || formValue, criticality: formCriticality, tags }, {
          onSuccess: () => toast.success('Asset added'),
          onError: () => { setLocalAssets(prev => [...prev, newAsset]); toast.success('Asset added (local)'); },
        });
      }
    }
    setDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    if (api.getDevMode()) {
      setLocalAssets(prev => prev.filter(a => a.id !== id));
      toast.success('Asset deleted');
    } else {
      deleteMutation.mutate(id, {
        onSuccess: () => toast.success('Asset deleted'),
        onError: () => { setLocalAssets(prev => prev.filter(a => a.id !== id)); toast.success('Asset deleted (local)'); },
      });
    }
  };

  const totalByType = (type: AssetType) => assets.filter(a => a.type === type).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Assets</h1>
          <p className="text-sm text-muted-foreground mt-1">Define the entities your organization wants to monitor. {assets.length} total assets.</p>
        </div>
        <Button onClick={openAdd} className="glow-cyan"><Plus className="mr-2 h-4 w-4" />Add Asset</Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AssetType)}>
        <TabsList className="bg-secondary/50 border border-border">
          {assetTabs.map(tab => (
            <TabsTrigger key={tab.type} value={tab.type} className="text-xs data-[state=active]:text-primary">
              {tab.label}
              {totalByType(tab.type) > 0 && <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">{totalByType(tab.type)}</Badge>}
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="mt-4">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search assets..." className="pl-10 bg-secondary/30" />
          </div>
          {assetTabs.map(tab => (
            <TabsContent key={tab.type} value={tab.type}>
              {filtered.length === 0 ? (
                <EmptyState icon="database" title={`No ${tab.label} Added`} description={`Add your organization's ${tab.label.toLowerCase()} to start monitoring for relevant threats.`} actionLabel={`Add ${tab.label.slice(0, -1)}`} onAction={openAdd} />
              ) : (
                <div className="space-y-2">
                  <AnimatePresence>
                    {filtered.map(asset => (
                      <motion.div key={asset.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                        <Card className="border-border bg-card hover:border-primary/20 transition-colors">
                          <CardContent className="flex items-center justify-between p-4">
                            <div className="flex items-center gap-4">
                              <div>
                                <p className="font-mono text-sm font-medium text-foreground">{asset.value}</p>
                                {asset.label !== asset.value && <p className="text-xs text-muted-foreground">{asset.label}</p>}
                              </div>
                              <SeverityBadge severity={asset.criticality} />
                              {asset.tags.map(tag => <Badge key={tag} variant="outline" className="text-xs"><Tag className="mr-1 h-3 w-3" />{tag}</Badge>)}
                            </div>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(asset)}><Pencil className="h-3.5 w-3.5" /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(asset.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </TabsContent>
          ))}
        </div>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>{editingAsset ? 'Edit Asset' : 'Add Asset'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><label className="mb-1.5 block text-sm font-medium">Value</label><Input value={formValue} onChange={e => setFormValue(e.target.value)} placeholder="e.g. example.com" className="bg-secondary/30" /></div>
            <div><label className="mb-1.5 block text-sm font-medium">Label (optional)</label><Input value={formLabel} onChange={e => setFormLabel(e.target.value)} placeholder="Friendly name" className="bg-secondary/30" /></div>
            <div><label className="mb-1.5 block text-sm font-medium">Criticality</label>
              <Select value={formCriticality} onValueChange={(v) => setFormCriticality(v as CriticalityTier)}>
                <SelectTrigger className="bg-secondary/30"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(criticalityMap).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><label className="mb-1.5 block text-sm font-medium">Tags (comma-separated)</label><Input value={formTags} onChange={e => setFormTags(e.target.value)} placeholder="web, production" className="bg-secondary/30" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!formValue.trim()} className="glow-cyan">{editingAsset ? 'Update' : 'Add'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
