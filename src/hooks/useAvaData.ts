import { useQuery } from "@tanstack/react-query";

const API_BASE = "https://ava-autonomous-agent-production.up.railway.app";

export interface AvaStatus {
  status: string;
  balance: {
    usdt: number;
    eth?: number;
  };
  lastDecision: {
    action: "BUY" | "SELL" | "HOLD";
    confidence: number;
    reasoning: string;
  };
  tradeCount: number;
  lastTrade?: {
    tx: string;
    amount?: number;
    timestamp?: string;
  };
  wallet?: string;
  ethPrice?: number;
}

export interface AvaInfo {
  name: string;
  description: string;
  wallet: string;
  status: string;
  endpoints: {
    free: string[];
    paid: string[];
  };
  pricing: Record<string, string>;
}

export function useAvaStatus() {
  return useQuery<AvaStatus>({
    queryKey: ["ava-status"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/status`);
      if (!res.ok) throw new Error("Failed to fetch AVA status");
      return res.json();
    },
    refetchInterval: 10000,
  });
}

export function useAvaInfo() {
  return useQuery<AvaInfo>({
    queryKey: ["ava-info"],
    queryFn: async () => {
      const res = await fetch(API_BASE);
      if (!res.ok) throw new Error("Failed to fetch AVA info");
      return res.json();
    },
    refetchInterval: 30000,
  });
}
