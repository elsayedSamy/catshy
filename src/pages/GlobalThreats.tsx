import { MapIcon } from 'lucide-react';

export default function GlobalThreats() {
  return (
    <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center -m-4">
      <div className="text-center space-y-3">
        <MapIcon className="h-12 w-12 text-muted-foreground/30 mx-auto" />
        <h1 className="text-lg font-semibold text-foreground">Global Threat Monitoring</h1>
        <p className="text-sm text-muted-foreground">Awaiting design specification.</p>
      </div>
    </div>
  );
}
