# AVA - Autonomous Value Agent

> An autonomous trading agent on X Layer that sells its signals to other agents via x402 payments

**Live Dashboard:** https://ava-autonomous-agent.vercel.app  
**API:** https://ava-autonomous-agent-production.up.railway.app  
**Network:** X Layer (Chain ID: 196)  
**Submission TX:** 0xd0b9ee18e11c52a820fae92f9099251cec1c9922a38e6ee3c7d40d51ee6b2416



## What Is AVA?

Ava is an autonomous onchain trading agent that executes strategies and monetizes its intelligence by selling access to its signals to other agents via x402.
Ava operates as a self-sustaining economic agent on X Layer. It trades autonomously using onchain market data, generates high-confidence signals from its strategies, and exposes those signals behind a programmable paywall.
Other agents, such as Nova, can request access to Ava’s signals. To unlock them, they must complete an onchain payment via x402 and submit a transaction hash. Ava verifies the payment and releases the signal in a fully trustless, agent-to-agent interaction. 
creating a self-sustaining economic loop where she earns USDT by selling signals and reinvests earnings into more trades.
The continous loop: AVA Trade → Generate Signals → Monetize via x402 → Verify Payment → Deliver Signal → Improve Strategy → Repeat


## Meet The Agents

### AVA (Autonomous Value Agent)
- Fetches live ETH-USDT market data via OKX Market API
- Makes autonomous BUY/SELL/HOLD decisions using Claude AI
- Executes real token swaps via OKX DEX Aggregator on X Layer
- Sells trading signals via x402 payment protocol
- Wallet: `0x00EdD1bE53767fD3e59F931B509176c7F50eC14d`

### NOVA (Network Oracle Value Agent)
- Autonomous agent that pays AVA for trading signals
- Uses x402 protocol to pay $0.001 USDT per signal
- Receives AVA's signal and uses it for trading decisions
- Demonstrates agent-to-agent economy on X Layer
- Wallet: `0x93fa3CF2841502e3B31f8A2F1817223Ea5E08213`



## Agent-to-Agent x402 Flow
```
1. NOVA hits AVA's /api/signal endpoint
2. AVA returns 402 Payment Required with payment details
3. NOVA sends 0.001 USDT to AVA on X Layer
4. NOVA sends TX hash as payment proof in request header
5. AVA verifies payment on X Layer blockchain
6. AVA serves trading signal to NOVA
7. Zero human involvement throughout
```



## Onchain OS APIs Used

| API | Usage |
|-----|-------|
| OKX Market API | Live ETH-USDT price data |
| OKX DEX Aggregator | Token swap execution |
| OKX Wallet API | AVA's wallet management |
| x402 Protocol | Agent-to-agent payments |



## Architecture
```
┌─────────────────────────────────────────┐
│           X Layer Blockchain             │
├─────────────────────────────────────────┤
│  AVA Agent          NOVA Agent          │
│  - Trades ETH/USDT  - Pays AVA          │
│  - Sells signals    - Gets signals      │
│  - x402 server      - x402 client       │
└─────────────────────────────────────────┘
         ↓ OKX DEX Aggregator
    Real token swaps on X Layer
```


## Tech Stack

- **Blockchain:** X Layer (Chain ID: 196)
- **AI Brain:** Claude Sonnet (Anthropic)
- **Market Data:** OKX Market API
- **Trading:** OKX DEX Aggregator V6
- **Payments:** x402 Protocol
- **Backend:** Node.js + Express (Railway)
- **Frontend:** React + Vite (Vercel)


## Live Proof

- **Submission TX:** `0xd0b9ee18e11c52a820fae92f9099251cec1c9922a38e6ee3c7d40d51ee6b2416`
- **NOVA→AVA Payment TX:** `0xb5e4f6e0d36b0bf6b86ef799dd6e147a45dc5c0277d549cac6f0885317d68145`
- **Explorer:** https://www.okx.com/web3/explorer/xlayer/address/0x00EdD1bE53767fD3e59F931B509176c7F50eC14d



## How To Run Locally
```bash
git clone https://github.com/web3smallie/ava-autonomous-agent
cd ava-autonomous-agent
npm install
cp .env.example .env
# Fill in your API keys in .env
node index.js



## Project Structure

autonomous-money-agent/
├── src/
│   ├── agent/
│   │   ├── loop.js      # AVA's trading loop
│   │   ├── brain.js     # AI decision engine
│   │   ├── executor.js  # Trade execution
│   │   └── market.js    # Market data
│   ├── api/
│   │   └── server.js    # x402 signal server
│   └── nova/
│       └── agent.js     # NOVA agent
├── frontend/            # React dashboard
├── index.js             # Entry point
└── package.json


Built for the X Layer Hackathon 2026