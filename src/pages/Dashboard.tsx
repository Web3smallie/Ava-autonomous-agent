import { useAvaStatus } from "@/hooks/useAvaData";
import Navbar from "@/components/Navbar";
import StatusCard from "@/components/StatusCard";
import WalletCard from "@/components/WalletCard";
import TradingDecisionCard from "@/components/TradingDecisionCard";
import PriceCard from "@/components/PriceCard";
import EndpointsCard from "@/components/EndpointsCard";
import TradeInfoCard from "@/components/TradeInfoCard";

const Dashboard = () => {
  const { data, isLoading } = useAvaStatus();

  return (
    <div className="min-h-screen bg-background grid-bg relative">
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden opacity-[0.03]">
        <div className="w-full h-px bg-primary scan-line" />
      </div>

      <Navbar />

      <main className="container mx-auto px-6 py-8">
        <div className="mb-10">
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground glow-text mb-2">
            {data?.name || "AVA Dashboard"}
          </h1>
          <p className="text-muted-foreground text-sm max-w-xl">
            {data?.description || "The first autonomous trading agent on X Layer"}
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-40 rounded-xl bg-card border border-border animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <StatusCard status={data?.status} />
            <WalletCard wallet={data?.wallet} balance={data?.balance?.usdt} />
            <TradingDecisionCard decision={data?.lastDecision} />
            <PriceCard ethPrice={data?.ethPrice} />
            <TradeInfoCard tradeCount={data?.tradeCount} lastTrade={data?.lastTrade} />
            <div className="md:col-span-2">
              <EndpointsCard info={data} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
