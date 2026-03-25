import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

interface BinancePrice {
  symbol: string;
  price: string;
}

const PriceCard = ({ ethPrice }: { ethPrice?: number }) => {
  const { data } = useQuery<BinancePrice>({
    queryKey: ["eth-price"],
    queryFn: async () => {
      const res = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT");
      if (!res.ok) throw new Error("Failed to fetch price");
      return res.json();
    },
    refetchInterval: 5000,
  });

  const price = ethPrice ?? (data ? parseFloat(data.price) : null);
  const isUp = price ? price > 2000 : true;

  return (
    <div className="rounded-xl border border-border bg-card p-6 animate-fade-in" style={{ animationDelay: "0.3s" }}>
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
        ETH-USDT Live Price
      </h3>
      {price === null ? (
        <div className="h-10 bg-secondary rounded animate-pulse" />
      ) : (
        <div className="flex items-center gap-3">
          <span className="font-display text-3xl font-bold text-foreground glow-text">
            ${price.toFixed(2)}
          </span>
          <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs ${
            isUp ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
          }`}>
            {isUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            LIVE
          </div>
        </div>
      )}
      <p className="text-xs text-muted-foreground mt-3">Auto-refreshes every 5s</p>
    </div>
  );
};

export default PriceCard;
