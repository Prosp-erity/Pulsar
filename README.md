# 🚀 Pulsar

> **⚡ A next-generation algorithmic trading platform for the modern trader**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=nextdotjs)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)](https://typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-06B6D4?style=for-the-badge&logo=tailwindcss)](https://tailwindcss.com/)
[![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite)](https://sqlite.org/)
[![License](https://img.shields.io/badge/License-Private-red?style=for-the-badge)](https://github.com/Prosp-erity/Pulsar)

---

## ✨ Features

### 📈 Trading Engine
- **⚡ Real-time tick processing** - Ultra-low latency market data handling
- **🎯 Multi-strategy support** - Run unlimited trading strategies simultaneously
- **📊 Backtesting** - Test strategies against historical data with detailed metrics
- **💼 Live trading** - Connect to brokers via MT5 bridge for real execution

### 🤖 AI Assistant
- **💬 Natural language interface** - Create and modify strategies with plain English
- **📰 Real-time market insights** - Get signals and analysis on demand
- **🎲 Automated trade suggestions** - AI-generated recommendations based on your criteria

### 📱 Dashboard
- **📈 Real-time equity curve** - Visualize your portfolio performance
- **💹 Position tracking** - Monitor all open positions
- **📊 KPI monitoring** - Track P&L, win rate, Sharpe ratio, and more
- **🔄 Strategy comparison** - Compare performance across multiple strategies
- **🛡️ Risk management** - Full control over your exposure

---

## 🛠️ Tech Stack

| Category | Technology |
|----------|------------|
| **Frontend** | Next.js 16, React 19, TypeScript |
| **UI Framework** | Tailwind CSS v4, shadcn/ui |
| **State Management** | Zustand |
| **Data Fetching** | TanStack Query |
| **Database** | SQLite (Prisma ORM) |
| **Charts** | Recharts |
| **Drag & Drop** | @dnd-kit |
| **Authentication** | NextAuth.js |
| **Internationalization** | next-intl |
| **MT5 Integration** | Custom bridge service |

---

## 🗂️ Project Structure

```
pulsar/
├── src/
│   ├── app/                    # 📁 Next.js App Router
│   │   ├── api/               # 🔌 API routes
│   │   │   └── assistant/     # 🤖 AI assistant endpoints
│   │   ├── landing/           # 🚀 Landing page
│   │   └── login/             # 🔐 Authentication
│   ├── components/
│   │   ├── trading/           # 📊 Trading-specific components
│   │   └── ui/                # 🎨 shadcn/ui components
│   ├── hooks/                 # ⚡ Custom React hooks
│   └── lib/
│       ├── db.ts              # 🗃️ Prisma database client
│       ├── store/             # 📦 Zustand stores
│       │   └── trading-store.ts
│       └── trading/           # ⚙️ Core trading logic
│           ├── engine.ts      # ⚡ Trading engine
│           ├── strategies.ts  # 🎯 Strategy definitions
│           ├── backtest.ts    # 📈 Backtesting engine
│           ├── indicators.ts  # 📉 Technical indicators
│           └── worker-manager.ts
├── mini-services/
│   └── mt5-bridge/            # 🌉 MetaTrader 5 bridge
│       ├── index.ts           # 🏃 Bridge server
│       └── PulsarBridge.mq5   # 📜 MT5 expert advisor
├── prisma/
│   └── schema.prisma          # 🗃️ Database schema
├── scripts/                   # 📜 Utility scripts
│   ├── debug-indicators.ts
│   ├── monitor-15min.sh
│   ├── prototype-strategies.ts
│   └── run-backtests.ts
├── public/                    # 🖼️ Static assets
├── Caddyfile                  # 🌐 Caddy reverse proxy config
├── package.json
└── README.md
```

---

## 🚀 Getting Started

### 📋 Prerequisites

- Node.js 18+ (or **Bun** for production - recommended)
- SQLite (built into most systems)
- MetaTrader 5 (optional, for live trading)

---

### 💻 Local Installation

#### 1. Clone the repository
```bash
📥 git clone https://github.com/Prosp-erity/Pulsar.git
📂 cd Pulsar
```

#### 2. Install dependencies
```bash
📦 npm install
# or (recommended for production)
📦 bun install
```

#### 3. Set up the database
```bash
🗃️ npm run db:generate
🗃️ npm run db:push
```

#### 4. Configure environment
```bash
📝 cp .env.example .env
# Edit .env with your database path
```

#### 5. Start the development server
```bash
▶️ npm run dev
```

#### 6. Open in browser
🌐 [http://localhost:3000](http://localhost:3000)

---

## 🎯 Deployment Options

### 🏭 Production Deployment (Self-Hosted)

#### Build the application
```bash
🔨 npm run build
```

#### Start the server
```bash
▶️ npm run start
```

#### (Optional) Use Caddy as reverse proxy
```bash
🌐 caddy run
```

---

### ☁️ Railway.app Deployment (Recommended VPS)

**Railway is the easiest way to deploy Pulsar with zero configuration!**

#### Step 1: Sign up for Railway
🔗 [https://railway.app](https://railway.app)

#### Step 2: Create a new project
```bash
➕ Click "New Project" → "Deploy from GitHub repo"
```

#### Step 3: Connect your repository
```bash
🔗 Select "Prosp-erity/Pulsar"
```

#### Step 4: Configure environment variables
Add these in Railway's **Variables** tab:

| Variable | Value | Description |
|----------|-------|-------------|
| `DATABASE_URL` | `file:/railway/db/pulsar.db` | SQLite database path |
| `PORT` | `3000` | Server port |
| `NODE_ENV` | `production` | Environment mode |

#### Step 5: Set up SQLite persistence
Railway provides persistent storage. Create a `railway.json` configuration:

```json
{
  "persistentVolumes": [
    {
      "name": "db",
      "path": "/railway/db"
    }
  ]
}
```

Or use Railway's **Volumes** feature to create a persistent volume at `/railway/db`

#### Step 6: Deploy!
```bash
🚀 Click "Deploy"
```

#### Step 7: Access your app
```
🌐 Your app will be available at: https://pulsar-<project-id>.up.railway.app
```

#### 💡 Railway Tips
- **Automatic deployments**: Enable "Auto-deploy on push" in project settings
- **Custom domain**: Add your own domain in the **Settings** tab
- **Monitoring**: Use Railway's built-in logs and metrics
- **Scaling**: Easily scale with Railway's pricing plans

#### ⚠️ Important Notes for Railway
- SQLite works great for personal use, but for high-frequency trading consider Railway's PostgreSQL add-on
- The MT5 bridge needs to run separately (not on Railway) since it requires direct connection to MetaTrader 5
- For 24/7 operation, consider Railway's **Always On** feature

---

### 📱 Running on Termux (Android)

**Trade on the go with your Android device!**

#### 📋 Prerequisites
- [Termux](https://termux.com/) installed (F-Droid version recommended)
- Termux:API app (optional, for notifications)

#### 🛠️ Setup

##### 1. Install dependencies in Termux
```bash
📥 pkg update && pkg upgrade
📦 pkg install nodejs git sqlite
```

##### 2. Install Bun (recommended for better performance)
```bash
🚀 curl -fsSL https://bun.sh/install | bash
```

##### 3. Clone and setup Pulsar
```bash
📥 git clone https://github.com/Prosp-erity/Pulsar.git
📂 cd Pulsar
📦 bun install
```

##### 4. Update .env for Termux
```bash
📝 echo "DATABASE_URL=file:./db/pulsar.db" > .env
```

##### 5. Initialize database
```bash
🗃️ bun run db:generate
🗃️ bun run db:push
```

##### 6. Build and run
```bash
🔨 bun run build
▶️ bun run start
```

#### 🖥️ Running in Background

Use **tmux** to keep the server running after closing Termux:

##### 1. Install tmux
```bash
📦 pkg install tmux
```

##### 2. Start a new tmux session
```bash
🖥️ tmux new -s pulsar
```

##### 3. Run the app inside tmux
```bash
▶️ bun run start
```

##### 4. Detach from tmux
Press `Ctrl+B`, then `D`

##### 5. Reattach later
```bash
🔗 tmux attach -t pulsar
```

#### 🌐 Accessing the App
- **On your Android device**: 🌐 [http://localhost:3000](http://localhost:3000)
- **From other devices**: 🌐 [http://<your-device-ip>:3000](http://<your-device-ip>:3000)

#### 💡 Tips for Termux
- Use `termux-wake-lock` to prevent the device from sleeping:
  ```bash
  📦 pkg install termux-api
  🔋 termux-wake-lock
  ```
- To find your local IP:
  ```bash
  🌐 ifconfig | grep "inet addr" | grep -v 127.0.0.1
  ```
- For better performance, **always use Bun** instead of Node.js
- Storage is limited; monitor disk usage with:
  ```bash
  💾 df -h
  ```

---

## 🌉 MT5 Bridge Setup

**Connect to MetaTrader 5 for live trading!**

### 🛠️ Setup

#### 1. Navigate to the bridge directory
```bash
📂 cd mini-services/mt5-bridge
```

#### 2. Install bridge dependencies
```bash
📦 npm install
```

#### 3. Copy `PulsarBridge.mq5` to your MT5 `MQL5/Experts/` directory

#### 4. Start the bridge server
```bash
▶️ npm start
```

#### ⚡ Pro Tip
Run the bridge on the same machine as your MT5 terminal for lowest latency.

---

## 📜 Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | 🛠️ Start development server |
| `npm run build` | 🔨 Build for production |
| `npm run start` | ▶️ Start production server |
| `npm run lint` | ✅ Run ESLint |
| `npm run db:generate` | 🗃️ Generate Prisma client |
| `npm run db:push` | 🚀 Push schema to database |
| `npm run db:migrate` | 🔄 Create and apply migrations |
| `npm run db:reset` | 🗑️ Reset database |

---

## ⚙️ Configuration

### 🌍 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | 🗃️ Database connection string | `file:./db/custom.db` |
| `NEXTAUTH_SECRET` | 🔐 NextAuth.js secret key | - |
| `NEXTAUTH_URL` | 🌐 Application URL | `http://localhost:3000` |
| `PORT` | 🌐 Server port | `3000` |

---

## 🏗️ Architecture

### ⚡ Trading Engine Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Main Thread    │────▶│  Worker Manager  │────▶│   Tick Worker   │
│  (UI Updates)    │     │  (Strategy Mgmt)│     │ (Data Processing)│
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

- **🧠 Tick Worker**: Processes incoming market ticks and calculates indicators
- **🎯 Worker Manager**: Manages strategy lifecycles and distributes work
- **📱 Main Thread**: Handles UI updates and user interactions

### 🎯 Strategy System

Strategies are defined in `src/lib/trading/strategies.ts` and can be:

- **🎲 Signal-based**: Generate buy/sell signals
- **💼 Execution-based**: Automatically execute trades
- **⚡ Hybrid**: Combine both approaches

Each strategy supports:
- ✅ Custom parameters
- ✅ Risk management rules
- ✅ Performance tracking
- ✅ Backtesting

---

## 🤝 Contributing

We welcome contributions! Here's how to help:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

---

## 📜 License

**Private - All rights reserved**

This is a personal trading system. Not for public distribution or commercial use.

---

## 💬 Support

For questions or support, please contact the project maintainers.

---

## 🙏 Acknowledgments

- Built with ❤️ using Next.js and the modern web stack
- Special thanks to all open-source contributors
- Inspired by the best trading platforms in the industry

---

**✨ Happy Trading! ✨**

*May your strategies be profitable and your drawdowns minimal.*
