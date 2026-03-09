import { motion } from 'framer-motion';
import { Radio, TestTube, Pencil, Trash2, Settings, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { HealthBadge } from '@/components/StatusBadge';
import type { SourceTemplate, ConnectorType } from '@/types';

const connectorLabels: Record<ConnectorType, string> = {
  rss_atom: 'RSS/Atom', http_json: 'HTTP JSON', http_csv: 'HTTP CSV',
  rest_api: 'REST API', taxii2: 'TAXII 2.x', imap: 'IMAP', webhook: 'Webhook',
};

interface Props {
  source: SourceTemplate;
  index: number;
  viewMode: 'grid' | 'list';
  testingSingle: boolean;
  onToggle: () => void;
  onTest: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSettings: () => void;
}

export function SourceCard({ source, index, viewMode, testingSingle, onToggle, onTest, onEdit, onDelete, onSettings }: Props) {
  if (viewMode === 'list') {
    return (
      <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.015 }}>
        <Card className={`border-border bg-card transition-all hover:border-primary/20 ${source.enabled ? 'border-l-2 border-l-success' : ''}`}>
          <CardContent className="flex items-center gap-4 p-3">
            <Switch checked={source.enabled} onCheckedChange={onToggle} />
            <Radio className="h-4 w-4 text-primary shrink-0" />
            <div className="min-w-[180px] flex-1">
              <h3 className="font-medium text-sm text-foreground leading-tight">{source.name}</h3>
              <p className="text-xs text-muted-foreground truncate max-w-[300px]">{source.description}</p>
            </div>
            <Badge variant="outline" className="text-xs shrink-0">{connectorLabels[source.connector_type]}</Badge>
            <HealthBadge health={source.health} />
            {source.item_count > 0 && <span className="text-xs text-muted-foreground shrink-0">{source.item_count} items</span>}
            {source.last_fetch_at && <span className="text-[10px] text-muted-foreground shrink-0">{new Date(source.last_fetch_at).toLocaleTimeString()}</span>}
            <div className="flex gap-1 shrink-0">
              {source.enabled && (
                <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={onTest} disabled={testingSingle}>
                  {testingSingle ? <Loader2 className="mr-1 h-2.5 w-2.5 animate-spin" /> : <TestTube className="mr-1 h-2.5 w-2.5" />}Test
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onEdit}><Pencil className="h-2.5 w-2.5" /></Button>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={onDelete}><Trash2 className="h-2.5 w-2.5" /></Button>
              {source.enabled && (
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onSettings}><Settings className="h-2.5 w-2.5" /></Button>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.02 }}>
      <Card className={`border-border bg-card transition-all hover:border-primary/20 ${source.enabled ? 'border-l-2 border-l-success' : ''}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-primary" />
              <h3 className="font-medium text-sm text-foreground">{source.name}</h3>
            </div>
            <Switch checked={source.enabled} onCheckedChange={onToggle} />
          </div>
          <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{source.description}</p>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Badge variant="outline" className="text-xs">{connectorLabels[source.connector_type]}</Badge>
            <HealthBadge health={source.health} />
            {source.item_count > 0 && <span className="text-xs text-muted-foreground">{source.item_count} items today</span>}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            {source.last_fetch_at && <span>Last fetch: {new Date(source.last_fetch_at).toLocaleTimeString()}</span>}
          </div>
          <div className="flex gap-1 mt-2">
            {source.enabled && (
              <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={onTest} disabled={testingSingle}>
                {testingSingle ? <Loader2 className="mr-1 h-2.5 w-2.5 animate-spin" /> : <TestTube className="mr-1 h-2.5 w-2.5" />}Test
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onEdit}><Pencil className="h-2.5 w-2.5" /></Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={onDelete}><Trash2 className="h-2.5 w-2.5" /></Button>
            {source.enabled && (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onSettings}><Settings className="h-2.5 w-2.5" /></Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
