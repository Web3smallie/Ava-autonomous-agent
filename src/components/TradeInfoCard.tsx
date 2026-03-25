import { ExternalLink, BarChart3 } from "lucide-react";

interface Props {
  tradeCount?: number;
  lastTrade?: {
    tx: string;
    amount?: number;
    timestamp?: string;
  };
}

const TradeInfoCard = ({ tradeCount, lastTrade }: Props) => {
  return (
    <div className="rounded-xl border border-border bg-card p-6 animate-fade-in" style={{ animationDelay: "0.35s" }}>
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
        Trade Activity
      </h3>
      <div className="flex items-center gap-3 mb-4">
        <BarChart3 size={20} className="text-primary" />
        <span className="font-display text-2xl font-bold text-foreground">
          {tradeCount ?? 0}
        </span>
        <span className="text-sm text-muted-foreground">Total Trades</span>
      </div>
      {lastTrade?.tx && (
        <div className="bg-secondary/50 rounded-lg p-4 border border-border">
          <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Last Trade TX</p>
          <a
            href={`https://explorer.xlayer.tech/tx/${lastTrade.tx}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline flex items-center gap-2 break-all"
          >
            {lastTrade.tx.slice(0, 20)}...{lastTrade.tx.slice(-8)}
            <ExternalLink size={14} />
          </a>
        </div>
      )}
    </div>
  );
};

export default TradeInfoCard;
