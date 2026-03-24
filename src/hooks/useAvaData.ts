import { useQuery } from "@tanstack/react-query";

const API_BASE = "https://ava-autonomous-agent-production.up.railway.app";

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

export interface AvaHealth {
  status: string;
  timestamp: string;
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

export function useAvaHealth() {
  return useQuery<AvaHealth>({
    queryKey: ["ava-health"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/health`);
      if (!res.ok) throw new Error("Failed to fetch AVA health");
      return res.json();
    },
    refetchInterval: 10000,
  });
}
