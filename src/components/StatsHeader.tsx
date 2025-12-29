import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Activity, Wifi, WifiOff, AlertTriangle, Clock, Layers } from 'lucide-react';
import { derivWS, ConnectionStatus } from '@/lib/deriv-websocket';
import { tradingEngine, TradingStats } from '@/lib/trading-engine';
import { cn } from '@/lib/utils';

export function StatsHeader() {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [accountCurrency, setAccountCurrency] = useState<string>('USD');
  const [stats, setStats] = useState<TradingStats>({
    totalTrades: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    totalProfit: 0,
    activeTradesCount: 0,
    isPaused: false,
    queueSize: 0,
    isThrottled: false,
  });

  useEffect(() => {
    const statusHandler = (status: ConnectionStatus) => {
      setConnectionStatus(status);
      if (status === 'authorized') {
        setAccountCurrency(derivWS.getAccountCurrency());
      }
    };

    derivWS.onStatusChange(statusHandler);
    tradingEngine.onStats(setStats);

    return () => {
      derivWS.offStatusChange(statusHandler);
    };
  }, []);

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'authorized':
        return 'text-profit';
      case 'connected':
        return 'text-warning';
      case 'connecting':
        return 'text-primary animate-pulse';
      default:
        return 'text-loss';
    }
  };

  const getStatusIcon = () => {
    if (connectionStatus === 'authorized' || connectionStatus === 'connected') {
      return <Wifi className="h-4 w-4" />;
    }
    if (connectionStatus === 'connecting') {
      return <Wifi className="h-4 w-4 animate-pulse" />;
    }
    return <WifiOff className="h-4 w-4" />;
  };

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center glow-primary">
                <Activity className="h-6 w-6 text-primary" />
              </div>
              <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-profit animate-pulse-glow" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground tracking-tight">DERIV-ASCEND</h1>
              <p className="text-xs text-muted-foreground font-mono">AI TRADING TERMINAL</p>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-6">
            {/* Total P/L */}
            <div className="flex flex-col items-center">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Total P/L</span>
              <div className={cn(
                "flex items-center gap-1 font-mono text-lg font-bold",
                stats.totalProfit >= 0 ? "text-profit" : "text-loss"
              )}>
                {stats.totalProfit >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                <span>{stats.totalProfit >= 0 ? '+' : ''}{stats.totalProfit.toFixed(2)} {accountCurrency}</span>
              </div>
            </div>

            {/* Win Rate */}
            <div className="flex flex-col items-center">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Win Rate</span>
              <span className={cn(
                "font-mono text-lg font-bold",
                stats.winRate >= 0.65 ? "text-profit" : stats.winRate >= 0.5 ? "text-warning" : "text-loss"
              )}>
                {(stats.winRate * 100).toFixed(1)}%
              </span>
            </div>

            {/* Trades */}
            <div className="flex flex-col items-center">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Trades</span>
              <span className="font-mono text-lg font-bold text-foreground">
                {stats.wins}W / {stats.losses}L
              </span>
            </div>

            {/* Active Trades */}
            <div className="flex flex-col items-center">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Active</span>
              <span className="font-mono text-lg font-bold text-primary">
                {stats.activeTradesCount}
              </span>
            </div>

            {/* Queue Size */}
            <div className="flex flex-col items-center">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Queue</span>
              <div className="flex items-center gap-1">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <span className={cn(
                  "font-mono text-lg font-bold",
                  stats.queueSize > 0 ? "text-warning" : "text-muted-foreground"
                )}>
                  {stats.queueSize}
                </span>
              </div>
            </div>

            {/* Throttle Status */}
            {stats.isThrottled && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-loss/20 text-loss animate-pulse">
                <Clock className="h-4 w-4" />
                <span className="text-xs font-mono uppercase">Throttled</span>
              </div>
            )}

            {/* Pause Status */}
            {stats.isPaused && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-warning/20 text-warning">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-xs font-mono uppercase">Calibrating</span>
              </div>
            )}

            {/* Connection Status */}
            <div className={cn("flex items-center gap-2", getStatusColor())}>
              {getStatusIcon()}
              <span className="text-xs font-mono uppercase">{connectionStatus}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
