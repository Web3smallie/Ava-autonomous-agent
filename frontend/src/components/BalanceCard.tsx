import { DollarSign } from "lucide-react";

const BalanceCard = ({ balance }: { balance?: number }) => {
  return (
    <div className="rounded-xl border border-border bg-card p-6 animate-fade-in" style={{ animationDelay: "0.15s" }}>
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
        Balance
      </h3>
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
          <DollarSign size={20} className="text-primary" />
        </div>
        <span className="text-2xl font-bold text-foreground">
          {balance !== undefined && balance !== null
            ? `$${balance.toFixed(4)} USDT`
            : "Loading..."}
        </span>
      </div>
    </div>
  );
};

export default BalanceCard;
