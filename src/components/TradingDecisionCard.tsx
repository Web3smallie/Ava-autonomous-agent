import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface Decision {
  action: "BUY" | "SELL" | "HOLD";
  confidence: number;
  reasoning: string;
}

const TradingDecisionCard = ({ decision }: { decision?: Decision | null }) => {
  const actionConfig = {
    BUY: { color: "text-primary", bg: "bg-primary/10 border-primary/20", icon: TrendingUp },
    SELL: { color: "text-destructive", bg: "bg-destructive/10 border-destructive/20", icon: TrendingDown },
    HOLD: { color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/20", icon: Minus },
  };

  if (!decision) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 animate-fade-in" style={{ animationDelay: "0.2s" }}>
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
          Last Trading Decision
        </h3>
        <p className="text-sm text-muted-foreground italic">Waiting for first trade...</p>
      </div>
    );
  }

  const action = decision.action;
  const config = actionConfig[action];
  const Icon = config.icon;
  const confidence = decision.confidence ?? 0;

  return (
    <div className="rounded-xl border border-border bg-card p-6 animate-fade-in" style={{ animationDelay: "0.2s" }}>
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
        Last Trading Decision
      </h3>
      <div className="flex items-center gap-4 mb-4">
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${config.bg}`}>
          <Icon size={20} className={config.color} />
          <span className={`font-display font-bold text-lg ${config.color}`}>
            {action}
          </span>
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Confidence</span>
            <span className="text-sm font-semibold text-foreground">{confidence}%</span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-1000"
              style={{ width: `${confidence}%` }}
            />
          </div>
        </div>
      </div>
      <div className="bg-secondary/50 rounded-lg p-4 border border-border">
        <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Reasoning</p>
        <p className="text-sm text-secondary-foreground leading-relaxed">
          {decision.reasoning || "No reasoning provided"}
        </p>
      </div>
    </div>
  );
};

export default TradingDecisionCard;
