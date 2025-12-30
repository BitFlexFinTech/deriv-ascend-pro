import { StatsHeader } from '@/components/StatsHeader';
import { Terminal } from '@/components/Terminal';
import { MarketScanner } from '@/components/MarketScanner';
import { TradingControls } from '@/components/TradingControls';
import { ActiveTrades } from '@/components/ActiveTrades';
import { TradeHistory } from '@/components/TradeHistory';
import { IntegrationsPanel } from '@/components/IntegrationsPanel';

const Index = () => {
  return (
    <div className="min-h-screen bg-background grid-pattern">
      {/* Ambient Glow Effect */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-profit/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <StatsHeader />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 relative z-10">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left Column - Markets & Controls */}
          <div className="xl:col-span-2 space-y-6">
            {/* Trading Controls */}
            <TradingControls />

            {/* Market Scanner */}
            <div className="border border-border rounded-lg bg-card/50 backdrop-blur-sm p-4">
              <h2 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                MARKET SCANNER
                <span className="text-xs text-muted-foreground ml-2">Real-time analysis</span>
              </h2>
              <MarketScanner />
            </div>

            {/* Terminal */}
            <div className="h-[350px]">
              <Terminal />
            </div>
          </div>

          {/* Right Column - Active Trades, History & Integrations */}
          <div className="space-y-6">
            {/* Active Trades */}
            <ActiveTrades />

            {/* Trade History */}
            <TradeHistory />

            {/* Integrations */}
            <IntegrationsPanel />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card/30 backdrop-blur-sm py-4 mt-8">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-mono">DERIV-ASCEND v1.0.0</span>
            <span>High-Frequency AI Trading Terminal</span>
            <span className="font-mono">© 2024</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
