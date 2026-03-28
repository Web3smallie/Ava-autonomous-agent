# AVA - Autonomous Value Agent

> The first autonomous AI trading agent on X Layer with onchain reputation, dynamic pricing, and agent-to-agent x402 payments

**Live Dashboard:** https://ava-nexus-view.vercel.app

**API:** https://ava-autonomous-agent-production.up.railway.app

**Network:** X Layer (Chain ID: 196)

**Reputation Contract:** `0xa45aACfC36B184Ef08C600DECACC4DC310ab0B1C`

**Submission TX:** `0xd0b9ee18e11c52a820fae92f9099251cec1c9922a38e6ee3c7d40d51ee6b2416`

## What Is AVA?

AVA (Autonomous Value Agent) is a fully autonomous AI trading agent on X Layer blockchain. She wakes up every 5 minutes, analyzes live ETH-USDT market data, makes BUY/SELL/HOLD decisions using Claude AI, executes real token swaps via OKX DEX, and sells her trading intelligence to other agents via x402 payments, all without human intervention.

AVA has an onchain reputation system, every trade she makes is recorded permanently on X Layer. Her signal price adjusts dynamically based on her verified success rate. The better she trades, the more she charges.

## New Features (v2)

### Commit-Reveal System (Zero Cherry-Picking)
Before every trade AVA commits her decision onchain. After execution she reveals the result. Zero cherry-picking — every decision locked in before execution.
- **Commit Contract:** `0x0f0D2CfaD46165595DF5F7986bC77Fa65Fe1c412`
- **Explorer:** https://www.okx.com/web3/explorer/xlayer/address/0x0f0D2CfaD46165595DF5F7986bC77Fa65Fe1c412

### Metacognition
AVA evaluates her own past decisions after every trade and adjusts strategy accordingly. See live at `/api/status` → `selfEvaluation` field.

### Risk Analysis
AVA assesses market risk before every trade — HIGH/MEDIUM/LOW. Check `/api/status` → `riskLevel` field.

### Onchain Reputation System
AVA's trading history is stored permanently on X Layer via a smart contract. After every trade, AVA calls `recordTrade()` to update her onchain reputation.

- **Contract:** `0xa45aACfC36B184Ef08C600DECACC4DC310ab0B1C`
- **Explorer:** https://explorer.xlayer.tech/address/0xa45aACfC36B184Ef08C600DECACC4DC310ab0B1C
- **Endpoint:** `/api/reputation`

### Dynamic Signal Pricing
AVA's signal price adjusts automatically based on her onchain success rate:

| Success Rate | Signal Price |
|-------------|-------------|
| 80%+ | $0.010 USDT |
| 70%+ | $0.005 USDT |
| 60%+ | $0.002 USDT |
| Base | $0.001 USDT |

### Balance-Based Trading Logic
AVA considers her actual wallet balances before every decision:
- Has USDT → looks to BUY
- Has WETH → looks to SELL
- Never suggests BUY if insufficient USDT
- Never suggests SELL if no WETH to sell

### NOVA Deployed 24/7 on Railway
NOVA runs autonomously on Railway, paying AVA for signals every 10 minutes without any human involvement. Even while you sleep, NOVA and AVA are transacting onchain.

## Meet The Agents

### AVA (Autonomous Value Agent)
- Fetches live ETH-USDT market data via OKX Market API
- Makes autonomous BUY/SELL/HOLD decisions using Claude AI
- Executes real token swaps via OKX DEX Aggregator on X Layer
- Records every trade to onchain reputation contract
- Sells trading signals via x402 with dynamic pricing
- Wallet: `0x00EdD1bE53767fD3e59F931B509176c7F50eC14d`

### NOVA (Network Oracle Value Agent)
- Autonomous agent running 24/7 on Railway
- Pays AVA for signals via x402 every 10 minutes
- Payment amount adjusts based on AVA's dynamic price
- Demonstrates fully autonomous agent-to-agent economy
- Wallet: `0x93fa3CF2841502e3B31f8A2F1817223Ea5E08213`

## Agent-to-Agent x402 Flow

```
1. NOVA hits AVA's /api/signal endpoint
2. AVA checks reputation contract for current signal price
3. AVA returns 402 Payment Required with dynamic price
4. NOVA sends USDT to AVA on X Layer
5. NOVA sends TX hash as payment proof
6. AVA verifies payment on X Layer blockchain
7. AVA serves trading signal to NOVA
8. AVA records signal sale to reputation contract
9. Zero human involvement throughout
```

## Proof of Multi-Agent Autonomous System

NOVA and AVA have been transacting autonomously 24/7 since deployment. Judges can verify this directly onchain:

- **NOVA wallet (all payments to AVA):** https://explorer.xlayer.tech/address/0x93fa3CF2841502e3B31f8A2F1817223Ea5E08213
- **AVA wallet (all trades + incoming payments):** https://explorer.xlayer.tech/address/0x00EdD1bE53767fD3e59F931B509176c7F50eC14d
- **Live reputation API:** https://ava-autonomous-agent-production.up.railway.app/api/reputation
- **Reputation contract:** https://explorer.xlayer.tech/address/0xa45aACfC36B184Ef08C600DECACC4DC310ab0B1C

## API Endpoints

| Endpoint | Type | Description |
|----------|------|-------------|
| `GET /` | Free | AVA info |
| `GET /health` | Free | Health check |
| `GET /api/status` | Free | Live status + decision |
| `GET /api/reputation` | Free | Onchain reputation data |
| `GET /api/signal` | x402 Paid | Trading signal |
| `GET /api/analysis` | x402 Paid | Full analysis |
| `GET /api/report` | x402 Paid | Market report |

## Tech Stack

- **Blockchain:** X Layer (Chain ID: 196)
- **AI Brain:** Claude Sonnet (Anthropic)
- **Market Data:** OKX Market API
- **Trading:** OKX DEX Aggregator V6
- **Payments:** x402 Protocol
- **Smart Contract:** Solidity (AVAReputation.sol)
- **Backend:** Node.js + Express (Railway)
- **Frontend:** React + Vite (Vercel)

## Live Proof

- **Submission TX:** `0xd0b9ee18e11c52a820fae92f9099251cec1c9922a38e6ee3c7d40d51ee6b2416`
- **NOVA→AVA Payment TX:** `0xb5e4f6e0d36b0bf6b86ef799dd6e147a45dc5c0277d549cac6f0885317d68145`
- **Reputation Contract:** `0xa45aACfC36B184Ef08C600DECACC4DC310ab0B1C`
- **AVA Explorer:** https://explorer.xlayer.tech/address/0x00EdD1bE53767fD3e59F931B509176c7F50eC14d
- **NOVA Explorer:** https://explorer.xlayer.tech/address/0x93fa3CF2841502e3B31f8A2F1817223Ea5E08213

## Architecture

```
AVA Agent (Railway)           NOVA Agent (Railway)
- Trades ETH/USDT        →    - Pays AVA via x402
- Sells signals          ←    - Gets signals
- x402 server                 - Runs 24/7 autonomously
- Updates reputation          
        ↓
  OKX DEX Aggregator
  Real swaps on X Layer
        ↓
  AVAReputation Contract
  Onchain trade history
  Dynamic signal pricing
```

## How To Run Locally

```bash
git clone https://github.com/web3smallie/ava-autonomous-agent
cd ava-autonomous-agent
npm install
cp .env.example .env
# Fill in your API keys in .env

# Run AVA
node index.js

# Run NOVA (separate terminal)
node src/nova/agent.js
```

## Project Structure

```
ava-autonomous-agent/
├── src/
│   ├── agent/
│   │   ├── loop.js        # AVA's trading loop
│   │   ├── brain.js       # AI decision engine (balance-based)
│   │   ├── executor.js    # Trade execution + reputation updates
│   │   └── market.js      # OKX market data
│   ├── api/
│   │   └── server.js      # x402 server + dynamic pricing
│   └── nova/
│       └── agent.js       # NOVA autonomous agent
├── AVAReputation.sol      # Onchain reputation contract
├── index.js               # Railway entry point
└── package.json
```

Built for the X Layer Hackathon 2026
```

