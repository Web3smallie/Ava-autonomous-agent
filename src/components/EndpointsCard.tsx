import { Lock, Unlock } from "lucide-react";
import type { AvaInfo } from "@/hooks/useAvaData";

const EndpointsCard = ({ info }: { info?: AvaInfo }) => {
  if (!info) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-6 animate-fade-in" style={{ animationDelay: "0.4s" }}>
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
        API Endpoints
      </h3>
      <div className="space-y-2">
        {info.endpoints.free.map((ep) => (
          <div key={ep} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-primary/5 border border-primary/10">
            <Unlock size={14} className="text-primary" />
            <code className="text-sm text-primary">{ep}</code>
            <span className="text-xs text-primary ml-auto">FREE</span>
          </div>
        ))}
        {info.endpoints.paid.map((ep) => (
          <div key={ep} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-secondary border border-border">
            <Lock size={14} className="text-muted-foreground" />
            <code className="text-sm text-secondary-foreground">{ep}</code>
            <span className="text-xs text-muted-foreground ml-auto">PAID</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EndpointsCard;
