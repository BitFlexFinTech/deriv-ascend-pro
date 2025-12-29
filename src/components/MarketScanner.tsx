import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Activity, Zap } from 'lucide-react';
import { DERIV_CONFIG } from '@/config/deriv';
import { derivWS, TickUpdate } from '@/lib/deriv-websocket';
import { calculateRSI, calculateADX, calculateBollingerBands } from '@/lib/indicators';
import { cn } from '@/lib/utils';

interface MarketData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  rsi: number | null;
  adx: number | null;
  signal: 'long' | 'short' | 'neutral';
  strength: number;
  history: number[];
}

const SYMBOL_NAMES: Record<string, string> = {
  'R_10': 'Volatility 10',
  'R_25': 'Volatility 25',
  'R_50': 'Volatility 50',
  'R_75': 'Volatility 75',
  'R_100': 'Volatility 100',
  '1HZ100V': '1HZ Volatility 100',
};

export function MarketScanner() {
  const [markets, setMarkets] = useState<Map<string, MarketData>>(new Map());

  useEffect(() => {
    // Initialize markets
    Object.values(DERIV_CONFIG.SYMBOLS).forEach(symbol => {
      setMarkets(prev => {
        const newMap = new Map(prev);
        newMap.set(symbol, {
          symbol,
          name: SYMBOL_NAMES[symbol] || symbol,
          price: 0,
          change: 0,
          changePercent: 0,
          rsi: null,
          adx: null,
          signal: 'neutral',
          strength: 0,
          history: [],
        });
        return newMap;
      });
    });

    // Subscribe to ticks
    const handler = (tick: TickUpdate) => {
      setMarkets(prev => {
        const newMap = new Map(prev);
        const existing = newMap.get(tick.symbol);
        
        if (existing) {
          const history = [...existing.history, tick.quote].slice(-50);
          const prevPrice = existing.price || tick.quote;
          const change = tick.quote - prevPrice;
          const changePercent = prevPrice > 0 ? (change / prevPrice) * 100 : 0;
          
          // Calculate indicators
          const rsi = history.length >= 15 ? calculateRSI(history) : null;
          const adx = history.length >= 28 ? calculateADX(history, history, history) : null;
          const bollinger = history.length >= 20 ? calculateBollingerBands(history) : null;
          
          // Determine signal
          let signal: 'long' | 'short' | 'neutral' = 'neutral';
          let strength = 0;
          
          if (rsi !== null) {
            if (rsi < 30) {
              signal = 'long';
              strength = Math.min(100, (30 - rsi) * 3);
            } else if (rsi > 70) {
              signal = 'short';
              strength = Math.min(100, (rsi - 70) * 3);
            }
          }
          
          if (bollinger && tick.quote <= bollinger.lower) {
            signal = 'long';
            strength = Math.max(strength, 70);
          } else if (bollinger && tick.quote >= bollinger.upper) {
            signal = 'short';
            strength = Math.max(strength, 70);
          }
          
          newMap.set(tick.symbol, {
            ...existing,
            price: tick.quote,
            change,
            changePercent,
            rsi,
            adx,
            signal,
            strength,
            history,
          });
        }
        
        return newMap;
      });
    };

    derivWS.onTick('*', handler);

    return () => {
      derivWS.offTick('*', handler);
    };
  }, []);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
      {Array.from(markets.values()).map((market) => (
        <div
          key={market.symbol}
          className={cn(
            "relative p-4 rounded-lg border bg-card overflow-hidden transition-all duration-300",
            market.signal === 'long' && market.strength > 50 && "border-profit/50",
            market.signal === 'short' && market.strength > 50 && "border-loss/50",
            market.signal === 'neutral' && "border-border"
          )}
        >
          {/* Signal Indicator */}
          {market.strength > 50 && (
            <div className={cn(
              "absolute top-0 right-0 px-2 py-0.5 text-xs font-mono uppercase rounded-bl-lg",
              market.signal === 'long' ? "bg-profit text-profit-foreground" : "bg-loss text-loss-foreground"
            )}>
              <Zap className="h-3 w-3 inline mr-1" />
              {market.signal}
            </div>
          )}

          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-mono text-sm font-medium text-foreground">{market.symbol}</h3>
              <p className="text-xs text-muted-foreground">{market.name}</p>
            </div>
            <Activity className={cn(
              "h-5 w-5",
              market.price > 0 ? "text-primary animate-pulse" : "text-muted-foreground"
            )} />
          </div>

          {/* Price */}
          <div className="mb-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-mono font-bold text-foreground">
                {market.price > 0 ? market.price.toFixed(4) : '-.----'}
              </span>
              {market.change !== 0 && (
                <span className={cn(
                  "flex items-center text-sm font-mono",
                  market.change >= 0 ? "text-profit" : "text-loss"
                )}>
                  {market.change >= 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                  {market.changePercent >= 0 ? '+' : ''}{market.changePercent.toFixed(2)}%
                </span>
              )}
            </div>
          </div>

          {/* Indicators */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center justify-between bg-secondary/50 rounded px-2 py-1">
              <span className="text-muted-foreground">RSI</span>
              <span className={cn(
                "font-mono font-medium",
                market.rsi !== null && market.rsi < 30 ? "text-profit" :
                market.rsi !== null && market.rsi > 70 ? "text-loss" : "text-foreground"
              )}>
                {market.rsi !== null ? market.rsi.toFixed(1) : '-'}
              </span>
            </div>
            <div className="flex items-center justify-between bg-secondary/50 rounded px-2 py-1">
              <span className="text-muted-foreground">ADX</span>
              <span className={cn(
                "font-mono font-medium",
                market.adx !== null && market.adx > 25 ? "text-primary" : "text-foreground"
              )}>
                {market.adx !== null ? market.adx.toFixed(1) : '-'}
              </span>
            </div>
          </div>

          {/* Signal Strength Bar */}
          {market.strength > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">Signal Strength</span>
                <span className={cn(
                  "font-mono",
                  market.signal === 'long' ? "text-profit" : "text-loss"
                )}>{market.strength.toFixed(0)}%</span>
              </div>
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-300",
                    market.signal === 'long' ? "bg-profit" : "bg-loss"
                  )}
                  style={{ width: `${market.strength}%` }}
                />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
