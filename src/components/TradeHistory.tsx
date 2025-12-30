import { useEffect, useState } from 'react';
import { History, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { tradingEngine, Trade } from '@/lib/trading-engine';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

export function TradeHistory() {
  const [trades, setTrades] = useState<Trade[]>([]);

  useEffect(() => {
    // Poll for trade journal updates
    const interval = setInterval(() => {
      setTrades(tradingEngine.getTradeJournal().slice(-50).reverse());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatDuration = (openTime: number, closeTime?: number) => {
    if (!closeTime) return '-';
    const seconds = Math.floor((closeTime - openTime) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  };

  if (trades.length === 0) {
    return (
      <div className="border border-border rounded-lg bg-card p-6">
        <h3 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          Trade History
        </h3>
        <div className="text-center py-8 text-muted-foreground">
          <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No completed trades yet</p>
          <p className="text-xs mt-1">Closed trades will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg bg-card p-4">
      <h3 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
        <History className="h-4 w-4 text-primary" />
        Trade History
        <span className="ml-auto px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-mono">
          {trades.length}
        </span>
      </h3>

      <ScrollArea className="h-[250px]">
        <div className="space-y-2">
          {trades.map((trade, index) => (
            <div
              key={`${trade.id}-${index}`}
              className={cn(
                "p-3 rounded-lg border bg-secondary/20",
                trade.result === 'win' ? "border-profit/30" : "border-loss/30"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
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
                  <span className="font-mono text-sm text-foreground">{trade.symbol}</span>
                </div>
                
                <div className={cn(
                  "px-2 py-0.5 rounded text-xs font-bold uppercase",
                  trade.result === 'win' 
                    ? "bg-profit/20 text-profit" 
                    : "bg-loss/20 text-loss"
                )}>
                  {trade.result?.toUpperCase()}
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 mt-2 text-xs">
                <div>
                  <div className="text-muted-foreground">Time</div>
                  <div className="font-mono text-foreground">{formatTime(trade.openTime)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Duration</div>
                  <div className="font-mono text-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDuration(trade.openTime, trade.closeTime)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Stake</div>
                  <div className="font-mono text-foreground">{trade.stake.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">P/L</div>
                  <div className={cn(
                    "font-mono font-bold",
                    trade.profit >= 0 ? "text-profit" : "text-loss"
                  )}>
                    {trade.profit >= 0 ? '+' : ''}{trade.profit.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
