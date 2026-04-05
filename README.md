# 🤖 AVA - Autonomous Value Agent

> The first autonomous AI trading agent on X Layer featuring onchain brain memory, proof of autonomous execution, XAuth agent delegation, ShadowLedger proof of intent, Self-Healing Gas Relayer (SHGR), agent-to-agent x402 payments, MCP server, and real technical analysis — all running 24/7 without human intervention.

**Live Dashboard:** [https://ava-nexus-view.vercel.app](https://ava-nexus-view.vercel.app)
**API:** [https://ava-autonomous-agent-production.up.railway.app](https://ava-autonomous-agent-production.up.railway.app)
**Network:** X Layer Mainnet (Chain ID: 196)
**GitHub:** [https://github.com/Web3smallie/Ava-autonomous-agent](https://github.com/Web3smallie/Ava-autonomous-agent)

---

## 🌟 What Is AVA?

AVA (Autonomous Value Agent) is a fully autonomous AI trading agent living on X Layer. Every 5 minutes, she wakes up and runs a complete autonomous cycle:

1. **Self-Healing Check:** Checks OKB gas balance — if low, requests a rescue from NOVA via x402.
2. **Agent Auth:** Ensures NOVA has an active XAuth delegation token to buy signals.
3. **Data Ingestion:** Fetches live ETH-USDT market data from OKX Market API.
4. **Technical Analysis:** Runs real indicators — RSI, MACD, Bollinger Bands, Support/Resistance.
5. **Onchain Memory:** Reads last 5 decisions from **AVABrain** to evaluate past performance.
6. **AI Reasoning:** Asks Claude AI to make a BUY/SELL/HOLD decision with full market context.
7. **Intent Logging:** Records reasoning to **ShadowLedger** onchain BEFORE executing.
8. **Fair Play:** Commits decision via **Commit-Reveal** to prevent cherry-picking.
9. **Execution:** Executes real token swaps via **OKX DEX Aggregator** on X Layer.
10. **Proof:** Proves autonomous execution onchain via **AVAProof**.
11. **Reputation:** Updates onchain reputation and sells intelligence to NOVA via **x402**.

---

## 👥 Meet The Agents

### AVA (The Trader & Signal Provider)
AVA is the brain. She runs a full TA pipeline, makes AI-powered decisions with metacognitive self-evaluation, executes trades, and monetizes her intelligence.
- **Wallet:** `0x00EdD1bE53767fD3e59F931B509176c7F50eC14d`
- **Cycle:** Every 5 minutes
- **Brain:** Claude 3 Haiku (Anthropic)

### NOVA (The Buyer & Medic)
NOVA is AVA's autonomous lifeline. Every 10 minutes, NOVA pays AVA for signals using x402 + XAuth (no private keys shared). NOVA also acts as the **Self-Healing Gas Relayer (SHGR)**—if AVA runs low on OKB, NOVA sends a rescue and AVA repays her in USDT automatically.
- **Wallet:** `0x93fa3CF2841502e3B31f8A2F1817223Ea5E08213`
- **Cycle:** Every 10 minutes

---

## ⛓️ Smart Contracts (X Layer Mainnet)

| Contract | Address | Purpose |
|----------|---------|---------|
| **AVABrain** | `0x4480d1B373Fb27254F95504A68E170E13b05bCeA` | Permanent Onchain Memory |
| **AVAProof** | `0xA7019A7D192BE0Fb9Da4EC1CD43eA59AA06E8026` | Proof of Autonomous Execution |
| **Commit-Reveal** | `0x0f0D2CfaD46165595DF5F7986bC77Fa65Fe1c412` | Zero Cherry-Picking Logic |
| **ShadowLedger** | `0xc7Dbf29bd9ADEfDD98344db756e35ECE8758C6C1` | Proof of Intent (Pre-trade) |
| **XAuth** | `0x68b9Ab523B6C7D4fb732C4a886E570400FFF8B50` | OAuth for AI Agents |
| **Reputation** | `0xa45aACfC36B184Ef08C600DECACC4DC310ab0B1C` | Onchain Track Record |
| **PriceOracle** | `0xbC93e68B12903A56Cd340fa34ad80Ee64E90018e` | AVA-powered Live Feed |

---

## 🔥 Key Innovations

### 1. Self-Healing Gas Relayer (SHGR)
The biggest killer of autonomous agents is "Gas Bankruptcy." AVA and NOVA solve this through a **Mutual Survival Mesh**.
- **Detection:** If OKB balance < 0.04, the agent sends a rescue request.
- **Rescue:** The partner sends 0.01 OKB.
- **Repayment:** The requesting agent pays the partner back in **USDT** at live market rates via x402.
- **Impact:** 100% uptime with zero human intervention.

### 2. ShadowLedger (Proof of Intent)
To solve the "AI Black Box" problem, AVA must record her **Intent** (RSI, MACD, and detailed reasoning) onchain *before* the trade is sent. This creates a verifiable audit trail of AI intelligence.

### 3. XAuth (OAuth for AI)
XAuth allows AVA to grant NOVA a "Delegation Token." NOVA can pay for signals using AVA's USDT budget without ever seeing AVA's private key. This is a breakthrough in secure multi-agent coordination.

### 4. MCP Server (Agent Interoperability)
AVA exposes a **Model Context Protocol (MCP)** server with 8 tools. Any compatible AI (like Claude Desktop) can connect and "ask" AVA for market analysis or trading signals directly.

---

## 🛠️ Tech Stack

- **Blockchain:** X Layer Mainnet (OKX)
- **AI Engine:** Claude 3 Haiku via Anthropic SDK
- **Trading:** OKX DEX Aggregator V6 & OKX Market API
- **Infrastructure:** Node.js, Express, Railway (Backend), React, Vite, Vercel (Frontend)
- **Protocols:** x402 (M2M Payments), MCP (Agent Tools)

---

## ⚠️ Demo Mode Note
For the Build X Season 2 Hackathon, technical filters (like the Bollinger Squeeze) have been relaxed. If AVA records 3 consecutive `HOLD` decisions, she is programmed to execute a micro-scalp trade. **This is a deliberate feature to ensure judges can verify the full XAuth, ShadowLedger, and Commit-Reveal pipeline within a standard 10-minute judging window.**

---

## 🚀 Run Locally

```bash
git clone [https://github.com/Web3smallie/Ava-autonomous-agent](https://github.com/Web3smallie/Ava-autonomous-agent)
cd ava-autonomous-agent
npm install
cp .env.example .env # Fill in your X Layer private keys & API keys
node index.js


## Built With

- ❤️ for Build X Season 2 — X Layer Hackathon 2026
- Powered by **Claude AI** (Anthropic)
- Trading via **OKX DEX Aggregator**
- Running on **X Layer Blockchain**
- Payments via **x402 Protocol**
- Agent Auth via **XAuth**
- Agent Protocol via **MCP**