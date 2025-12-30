import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Clock, Target, X, Loader2 } from 'lucide-react';
import { tradingEngine, Trade } from '@/lib/trading-engine';
import { derivWS } from '@/lib/deriv-websocket';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

export function ActiveTrades() {
  const [trades, setTrades] = useState<Trade[]>([]);

  useEffect(() => {
    const handler = (trade: Trade) => {
      setTrades(prev => {
        const existing = prev.findIndex(t => t.id === trade.id);
        if (existing >= 0) {
          const newTrades = [...prev];
          newTrades[existing] = trade;
          return newTrades;
        }
        return [...prev, trade];
      });
    };

    tradingEngine.onTrade(handler);

    // Poll for active trades
    const interval = setInterval(() => {
      setTrades(tradingEngine.getActiveTrades());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatDuration = (openTime: number) => {
    const seconds = Math.floor((Date.now() - openTime) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  };

  const [closingTrades, setClosingTrades] = useState<Set<string>>(new Set());

  const handleCloseTrade = async (trade: Trade) => {
    if (!trade.contractId || trade.status !== 'open') return;
    
    setClosingTrades(prev => new Set(prev).add(trade.id));
    
    try {
      const result = await derivWS.sellContract(trade.contractId, 0);
      if (result.success) {
        toast({
          title: "Trade Closed",
          description: `Closed ${trade.symbol} position`,
        });
      } else {
        toast({
          title: "Close Failed",
          description: result.error || "Failed to close trade",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to close trade",
        variant: "destructive",
      });
    } finally {
      setClosingTrades(prev => {
        const next = new Set(prev);
        next.delete(trade.id);
        return next;
      });
    }
  };

  if (trades.length === 0) {
    return (
      <div className="border border-border rounded-lg bg-card p-6">
        <h3 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          Active Positions
        </h3>
        <div className="text-center py-8 text-muted-foreground">
          <Target className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No active positions</p>
          <p className="text-xs mt-1">Trades will appear here when opened</p>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg bg-card p-4">
      <h3 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
        <Target className="h-4 w-4 text-primary" />
        Active Positions
        <span className="ml-auto px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-mono">
          {trades.length}
        </span>
      </h3>

      <div className="space-y-3">
        {trades.map((trade) => (
          <div
            key={trade.id}
            className={cn(
              "relative p-3 rounded-lg border bg-secondary/30 animate-fade-in",
              trade.direction === 'LONG' ? "border-profit/30" : "border-loss/30"
            )}
          >
            {/* Direction Badge & Close Button */}
            <div className="absolute top-2 right-2 flex items-center gap-2">
              <div className={cn(
                "px-2 py-0.5 rounded text-xs font-mono font-bold uppercase",
                trade.direction === 'LONG' 
                  ? "bg-profit/20 text-profit" 
                  : "bg-loss/20 text-loss"
              )}>
                {trade.direction === 'LONG' ? (
                  <><TrendingUp className="h-3 w-3 inline mr-1" />LONG</>
                ) : (
                  <><TrendingDown className="h-3 w-3 inline mr-1" />SHORT</>
                )}
              </div>
              
              {trade.status === 'open' && trade.contractId && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-loss hover:bg-loss/20"
                  onClick={() => handleCloseTrade(trade)}
                  disabled={closingTrades.has(trade.id)}
                >
                  {closingTrades.has(trade.id) ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <X className="h-3 w-3" />
                  )}
                </Button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div>
                <div className="font-mono text-sm font-medium text-foreground">
                  {trade.symbol}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                  <Clock className="h-3 w-3" />
                  {formatDuration(trade.openTime)}
                </div>
              </div>

              <div className="flex-1 grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-xs text-muted-foreground">Entry</div>
                  <div className="font-mono text-sm text-foreground">
                    {trade.entryPrice.toFixed(4)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Current</div>
                  <div className="font-mono text-sm text-foreground">
                    {trade.currentPrice.toFixed(4)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">P/L</div>
                  <div className={cn(
                    "font-mono text-sm font-bold",
                    trade.profit >= 0 ? "text-profit" : "text-loss"
                  )}>
                    {trade.profit >= 0 ? '+' : ''}{trade.profit.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-3 h-1 bg-secondary rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  trade.profit >= 0 ? "bg-profit" : "bg-loss"
                )}
                style={{ 
                  width: `${Math.min(100, Math.abs(trade.profit) * 10)}%` 
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
