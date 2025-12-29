import { useState, useEffect } from 'react';
import { Play, Pause, Settings, RefreshCw, DollarSign, Shield, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { tradingEngine, TradingStats } from '@/lib/trading-engine';
import { DERIV_CONFIG } from '@/config/deriv';
import { cn } from '@/lib/utils';

export function TradingControls() {
  const [isRunning, setIsRunning] = useState(false);
  const [stake, setStake] = useState<number>(DERIV_CONFIG.DEFAULT_STAKE);
  const [stats, setStats] = useState<TradingStats | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    tradingEngine.onStats(setStats);
  }, []);

  const handleToggle = () => {
    if (isRunning) {
      tradingEngine.stop();
    } else {
      tradingEngine.start();
    }
    setIsRunning(!isRunning);
  };

  const handleStakeChange = (value: number) => {
    setStake(value);
    tradingEngine.setStake(value);
  };

  return (
    <div className="border border-border rounded-lg bg-card p-4">
      {/* Main Controls */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button
            variant={isRunning ? "loss" : "profit"}
            size="lg"
            onClick={handleToggle}
            className="gap-2"
          >
            {isRunning ? (
              <>
                <Pause className="h-5 w-5" />
                STOP ENGINE
              </>
            ) : (
              <>
                <Play className="h-5 w-5" />
                START ENGINE
              </>
            )}
          </Button>
          
          <Button
            variant="terminal"
            size="lg"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings className={cn("h-5 w-5 transition-transform", showSettings && "rotate-90")} />
          </Button>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg",
            isRunning ? "bg-profit/20 text-profit" : "bg-muted text-muted-foreground"
          )}>
            <div className={cn(
              "h-2 w-2 rounded-full",
              isRunning ? "bg-profit animate-pulse" : "bg-muted-foreground"
            )} />
            <span className="font-mono text-sm uppercase">
              {isRunning ? 'SCANNING' : 'IDLE'}
            </span>
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="border-t border-border pt-4 mt-4 animate-fade-in">
          <h3 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
            <Settings className="h-4 w-4 text-primary" />
            Risk Parameters
          </h3>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Stake Control */}
            <div className="bg-secondary/50 rounded-lg p-3">
              <label className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <DollarSign className="h-3 w-3" />
                STAKE (USD)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={DERIV_CONFIG.DEFAULT_STAKE}
                  max={DERIV_CONFIG.MAX_STAKE}
                  step={0.5}
                  value={stake}
                  onChange={(e) => handleStakeChange(parseFloat(e.target.value))}
                  className="flex-1 accent-primary"
                />
                <span className="font-mono text-lg font-bold text-foreground w-16 text-right">
                  {stake.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Min Probability */}
            <div className="bg-secondary/50 rounded-lg p-3">
              <label className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <Zap className="h-3 w-3" />
                MIN PROBABILITY
              </label>
              <div className="font-mono text-lg font-bold text-primary">
                {(DERIV_CONFIG.MIN_PROBABILITY * 100).toFixed(0)}%
              </div>
            </div>

            {/* Stop Loss */}
            <div className="bg-secondary/50 rounded-lg p-3">
              <label className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <Shield className="h-3 w-3" />
                STOP LOSS
              </label>
              <div className="font-mono text-lg font-bold text-loss">
                {(DERIV_CONFIG.STOP_LOSS_PERCENT * 100).toFixed(0)}%
              </div>
            </div>

            {/* Win Rate Floor */}
            <div className="bg-secondary/50 rounded-lg p-3">
              <label className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <RefreshCw className="h-3 w-3" />
                WIN RATE FLOOR
              </label>
              <div className="font-mono text-lg font-bold text-warning">
                {(DERIV_CONFIG.WIN_RATE_FLOOR * 100).toFixed(0)}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-border">
          <div className="text-center">
            <div className="text-xs text-muted-foreground mb-1">Total Trades</div>
            <div className="font-mono text-xl font-bold text-foreground">{stats.totalTrades}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground mb-1">Win/Loss</div>
            <div className="font-mono text-xl font-bold">
              <span className="text-profit">{stats.wins}</span>
              <span className="text-muted-foreground">/</span>
              <span className="text-loss">{stats.losses}</span>
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground mb-1">Win Rate</div>
            <div className={cn(
              "font-mono text-xl font-bold",
              stats.winRate >= 0.65 ? "text-profit" : stats.winRate >= 0.5 ? "text-warning" : "text-loss"
            )}>
              {(stats.winRate * 100).toFixed(1)}%
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground mb-1">Active</div>
            <div className="font-mono text-xl font-bold text-primary">{stats.activeTradesCount}</div>
          </div>
        </div>
      )}
    </div>
  );
}
