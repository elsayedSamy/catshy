import { Pencil, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  onNameChange: (v: string) => void;
  description: string;
  onDescriptionChange: (v: string) => void;
  url: string;
  onUrlChange: (v: string) => void;
  interval: string;
  onIntervalChange: (v: string) => void;
  onSave: () => void;
  saving: boolean;
}

export function EditSourceDialog({ open, onOpenChange, name, onNameChange, description, onDescriptionChange, url, onUrlChange, interval, onIntervalChange, onSave, saving }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />Edit Source
          </DialogTitle>
          <DialogDescription>Update source configuration.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Name</label>
            <Input value={name} onChange={e => onNameChange(e.target.value)} className="bg-secondary/30" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Description</label>
            <Input value={description} onChange={e => onDescriptionChange(e.target.value)} className="bg-secondary/30" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Feed URL</label>
            <Input value={url} onChange={e => onUrlChange(e.target.value)} className="bg-secondary/30 font-mono text-sm" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Polling Interval (minutes)</label>
            <Input value={interval} onChange={e => onIntervalChange(e.target.value)} type="number" className="bg-secondary/30 w-32" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSave} disabled={!name.trim() || saving} className="glow-cyan">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
