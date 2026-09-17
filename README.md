# Pulsar

A next-generation trading platform built with Next.js, React, and TypeScript. Pulsar provides real-time market data visualization, algorithmic trading strategies, backtesting capabilities, and an AI-powered assistant for traders.

## Features

### Trading Engine
- **Real-time tick processing** - Handle market data with ultra-low latency
- **Multi-strategy support** - Run multiple trading strategies simultaneously
- **Backtesting** - Test strategies against historical data with detailed metrics
- **Live trading** - Connect to brokers via MT5 bridge for execution

### AI Assistant
- Natural language interface for strategy creation and analysis
- Real-time market insights and signals
- Automated trade suggestions based on your criteria

### Dashboard
- Real-time equity curve visualization
- Position and trade tracking
- KPI monitoring (P&L, win rate, Sharpe ratio, etc.)
- Strategy performance comparison
- Risk management controls

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript
- **UI**: Tailwind CSS v4, shadcn/ui components
- **State Management**: Zustand
- **Data Fetching**: TanStack Query
- **Database**: SQLite (Prisma ORM)
- **Charts**: Recharts
- **Drag & Drop**: @dnd-kit
- **Authentication**: NextAuth.js
- **Internationalization**: next-intl
- **MT5 Integration**: Custom bridge service

## Project Structure

```
pulsar/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API routes
│   │   │   └── assistant/     # AI assistant endpoints
│   │   ├── landing/           # Landing page
│   │   └── login/             # Authentication
│   ├── components/
│   │   ├── trading/           # Trading-specific components
│   │   └── ui/                # shadcn/ui components
│   ├── hooks/                 # Custom React hooks
│   └── lib/
│       ├── db.ts              # Prisma database client
│       ├── store/             # Zustand stores
│       │   └── trading-store.ts
│       └── trading/           # Core trading logic
│           ├── engine.ts      # Trading engine
│           ├── strategies.ts  # Strategy definitions
│           ├── backtest.ts    # Backtesting engine
│           ├── indicators.ts  # Technical indicators
│           └── worker-manager.ts
├── mini-services/
│   └── mt5-bridge/            # MetaTrader 5 bridge
│       ├── index.ts           # Bridge server
│       └── PulsarBridge.mq5   # MT5 expert advisor
├── prisma/
│   └── schema.prisma          # Database schema
├── scripts/                   # Utility scripts
│   ├── debug-indicators.ts
│   ├── monitor-15min.sh
│   ├── prototype-strategies.ts
│   └── run-backtests.ts
├── public/                    # Static assets
├── Caddyfile                  # Caddy reverse proxy config
├── package.json
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+ (or Bun for production)
- SQLite
- MetaTrader 5 (optional, for live trading)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Prosp-erity/Pulsar.git
   cd Pulsar
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   bun install
   ```

3. Set up the database:
   ```bash
   npm run db:generate
   npm run db:push
   ```

4. Configure environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your database path
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000)

### Production Deployment

1. Build the application:
   ```bash
   npm run build
   ```

2. Start the server:
   ```bash
   npm run start
   ```

3. (Optional) Use Caddy as reverse proxy:
   ```bash
   caddy run
   ```

## MT5 Bridge Setup

For live trading with MetaTrader 5:

1. Navigate to the bridge directory:
   ```bash
   cd mini-services/mt5-bridge
   ```

2. Install bridge dependencies:
   ```bash
   npm install
   ```

3. Copy `PulsarBridge.mq5` to your MT5 `MQL5/Experts/` directory
4. Start the bridge server:
   ```bash
   npm start
   ```

## Running on Termux (Android)

Pulsar can run on Termux for mobile trading on Android devices.

### Prerequisites
- [Termux](https://termux.com/) installed (F-Droid version recommended)
- Termux:API app (optional, for notifications)

### Setup

1. **Install dependencies in Termux:**
   ```bash
   pkg update && pkg upgrade
   pkg install nodejs git sqlite
   ```

2. **Install Bun (recommended for better performance):**
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

3. **Clone and setup Pulsar:**
   ```bash
   git clone https://github.com/Prosp-erity/Pulsar.git
   cd Pulsar
   bun install
   ```

4. **Update .env for Termux:**
   ```bash
   echo "DATABASE_URL=file:./db/pulsar.db" > .env
   ```

5. **Initialize database:**
   ```bash
   bun run db:generate
   bun run db:push
   ```

6. **Build and run:**
   ```bash
   bun run build
   bun run start
   ```

### Running in Background

Use `tmux` to keep the server running after closing Termux:

1. Install tmux:
   ```bash
   pkg install tmux
   ```

2. Start a new tmux session:
   ```bash
   tmux new -s pulsar
   ```

3. Run the app inside tmux:
   ```bash
   bun run start
   ```

4. Detach from tmux (press Ctrl+B, then D)

5. Reattach later:
   ```bash
   tmux attach -t pulsar
   ```

### Accessing the App

- On your Android device: `http://localhost:3000`
- From other devices on the same network: `http://<your-device-ip>:3000`

### Tips for Termux

- Use `termux-wake-lock` to prevent the device from sleeping:
  ```bash
  pkg install termux-api
  termux-wake-lock
  ```
- To find your local IP:
  ```bash
  ifconfig | grep "inet addr" | grep -v 127.0.0.1
  ```
- For better performance, use Bun instead of Node.js
- Storage is limited; monitor disk usage with `df -h`

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema to database |
| `npm run db:migrate` | Create and apply migrations |
| `npm run db:reset` | Reset database |

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | Database connection string | `file:./db/custom.db` |
| `NEXTAUTH_SECRET` | NextAuth.js secret key | - |
| `NEXTAUTH_URL` | Application URL | `http://localhost:3000` |

## Architecture

### Trading Engine

The trading engine uses a worker-based architecture for performance:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Main Thread    │────▶│  Worker Manager  │────▶│   Tick Worker   │
│  (UI Updates)    │     │  (Strategy Mgmt)│     │ (Data Processing)│
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

- **Tick Worker**: Processes incoming market ticks and calculates indicators
- **Worker Manager**: Manages strategy lifecycles and distributes work
- **Main Thread**: Handles UI updates and user interactions

### Strategy System

Strategies are defined in `src/lib/trading/strategies.ts` and can be:
- **Signal-based**: Generate buy/sell signals
- **Execution-based**: Automatically execute trades
- **Hybrid**: Combine both approaches

Each strategy supports:
- Custom parameters
- Risk management rules
- Performance tracking
- Backtesting

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

Private - All rights reserved

## Contact

For questions or support, please contact the project maintainers.
