import { Copy, Check } from "lucide-react";
import { useState } from "react";

const WalletCard = ({ wallet }: { wallet?: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (wallet) {
      navigator.clipboard.writeText(wallet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6 animate-fade-in" style={{ animationDelay: "0.1s" }}>
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
        Wallet Address
      </h3>
      <div className="flex items-center gap-3">
        <code className="text-xs sm:text-sm text-primary bg-primary/5 border border-primary/10 rounded-lg px-3 py-2 flex-1 truncate">
          {wallet || "Loading..."}
        </code>
        <button
          onClick={handleCopy}
          className="p-2 rounded-lg border border-border hover:border-primary/30 hover:bg-primary/5 transition-all"
        >
          {copied ? <Check size={16} className="text-primary" /> : <Copy size={16} className="text-muted-foreground" />}
        </button>
      </div>
      <p className="text-xs text-muted-foreground mt-3">Network: X Layer</p>
    </div>
  );
};

export default WalletCard;
