import { useQuery } from "@tanstack/react-query";

const API_BASE = "https://ava-autonomous-agent-production.up.railway.app";

export interface AvaStatus {
  name: string;
  description: string;
  wallet: string;
  status: string;
  endpoints: {
    free: string[];
    paid: string[];
  };
  pricing: Record<string, string>;
  balance?: {
    usdt: number;
    eth?: number;
  };
  lastDecision?: {
    action: "BUY" | "SELL" | "HOLD";
    confidence: number;
    reasoning: string;
  } | null;
  tradeCount?: number;
  lastTrade?: {
    tx: string;
    amount?: number;
    timestamp?: string;
  };
  ethPrice?: number;
}

// Keep AvaInfo as alias for backward compat
export type AvaInfo = AvaStatus;

export function useAvaStatus() {
  return useQuery<AvaStatus>({
    queryKey: ["ava-status"],
    queryFn: async () => {
      const res = await fetch(API_BASE);
      if (!res.ok) throw new Error("Failed to fetch AVA status");
      return res.json();
    },
    refetchInterval: 10000,
  });
}

// Keep useAvaInfo pointing to same data
export function useAvaInfo() {
  return useAvaStatus();
}
