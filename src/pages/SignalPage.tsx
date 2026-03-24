import { Copy, Check, Zap, Shield, ArrowRight } from "lucide-react";
import { useState } from "react";
import Navbar from "@/components/Navbar";

const WALLET = "0x00EdD1bE53767fD3e59F931B509176c7F50eC14d";

const SignalPage = () => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(WALLET);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background grid-bg relative">
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden opacity-[0.03]">
        <div className="w-full h-px bg-primary scan-line" />
      </div>

      <Navbar />

      <main className="container mx-auto px-6 py-8 max-w-2xl">
        <div className="text-center mb-10 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium mb-6">
            <Zap size={12} />
            AI-POWERED SIGNALS
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground glow-text mb-3">
            Pay for AVA's Signal
          </h1>
          <p className="text-muted-foreground text-sm">
            Get real-time AI trading signals powered by autonomous analysis
          </p>
        </div>

        {/* Price card */}
        <div className="rounded-xl border border-primary/20 bg-card p-8 glow-green animate-fade-in mb-6" style={{ animationDelay: "0.1s" }}>
          <div className="text-center mb-8">
            <p className="text-muted-foreground text-sm mb-2">Signal Price</p>
            <div className="flex items-baseline justify-center gap-1">
              <span className="font-display text-5xl font-bold text-primary glow-text">$0.001</span>
              <span className="text-muted-foreground text-lg">USDT</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Per API call</p>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Send payment to</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs text-primary bg-primary/5 border border-primary/10 rounded-lg px-3 py-3 truncate">
                  {WALLET}
                </code>
                <button
                  onClick={handleCopy}
                  className="p-3 rounded-lg border border-primary/20 hover:bg-primary/10 transition-all"
                >
                  {copied ? <Check size={16} className="text-primary" /> : <Copy size={16} className="text-muted-foreground" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-secondary border border-border">
              <Shield size={16} className="text-primary" />
              <div>
                <p className="text-sm text-foreground font-medium">Network: X Layer</p>
                <p className="text-xs text-muted-foreground">Ensure you're on the correct network</p>
              </div>
            </div>
          </div>
        </div>

        {/* After payment */}
        <div className="rounded-xl border border-border bg-card p-6 animate-fade-in" style={{ animationDelay: "0.2s" }}>
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
            After Payment
          </h3>
          <div className="space-y-3">
            {[
              "Send $0.001 USDT to AVA's wallet on X Layer",
              "Wait for transaction confirmation (~5 seconds)",
              "Call the /api/signal endpoint with your wallet address",
              "Receive AVA's real-time trading signal with confidence score",
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-primary">{i + 1}</span>
                </div>
                <p className="text-sm text-secondary-foreground">{step}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing tiers */}
        <div className="mt-6 rounded-xl border border-border bg-card p-6 animate-fade-in" style={{ animationDelay: "0.3s" }}>
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
            All Endpoints
          </h3>
          <div className="space-y-2">
            {[
              { endpoint: "/api/signal", price: "$0.001 USDT" },
              { endpoint: "/api/analysis", price: "$0.005 USDT" },
              { endpoint: "/api/report", price: "$0.01 USDT" },
            ].map(({ endpoint, price }) => (
              <div key={endpoint} className="flex items-center justify-between px-4 py-3 rounded-lg bg-secondary border border-border">
                <div className="flex items-center gap-2">
                  <ArrowRight size={14} className="text-primary" />
                  <code className="text-sm text-foreground">{endpoint}</code>
                </div>
                <span className="text-sm font-medium text-primary">{price}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default SignalPage;
