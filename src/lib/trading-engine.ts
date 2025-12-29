import { DERIV_CONFIG, SymbolValue } from '@/config/deriv';
import { derivWS, TickUpdate } from './deriv-websocket';
import { calculateAllIndicators, IndicatorResult } from './indicators';

export interface TradeSignal {
  symbol: string;
  direction: 'LONG' | 'SHORT';
  probability: number;
  reasoning: string;
  indicators: IndicatorResult;
  timestamp: number;
}

export interface Trade {
  id: string;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  currentPrice: number;
  stake: number;
  profit: number;
  status: 'open' | 'closed' | 'pending';
  openTime: number;
  closeTime?: number;
  result?: 'win' | 'loss';
}

export interface TradingStats {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalProfit: number;
  activeTradesCount: number;
  isPaused: boolean;
  pauseReason?: string;
}

export interface LogEntry {
  timestamp: number;
  type: 'info' | 'signal' | 'trade' | 'warning' | 'error' | 'ai';
  symbol?: string;
  message: string;
  data?: any;
}

type LogHandler = (entry: LogEntry) => void;
type StatsHandler = (stats: TradingStats) => void;
type SignalHandler = (signal: TradeSignal) => void;
type TradeHandler = (trade: Trade) => void;

class TradingEngine {
  private priceHistory: Map<string, number[]> = new Map();
  private activeTrades: Map<string, Trade> = new Map();
  private tradeJournal: Trade[] = [];
  private stats: TradingStats = {
    totalTrades: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    totalProfit: 0,
    activeTradesCount: 0,
    isPaused: false,
  };
  
  private logHandlers: LogHandler[] = [];
  private statsHandlers: StatsHandler[] = [];
  private signalHandlers: SignalHandler[] = [];
  private tradeHandlers: TradeHandler[] = [];
  
  private isRunning = false;
  private stake = DERIV_CONFIG.DEFAULT_STAKE;
  private symbolAdjustments: Map<string, number> = new Map();
  
  private readonly HISTORY_SIZE = 100;

  constructor() {
    // Initialize price history for all symbols
    Object.values(DERIV_CONFIG.SYMBOLS).forEach(symbol => {
      this.priceHistory.set(symbol, []);
    });
  }

  public start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.log('info', 'Trading engine started');
    
    // Subscribe to all symbols
    Object.values(DERIV_CONFIG.SYMBOLS).forEach(symbol => {
      derivWS.subscribeTicks(symbol);
      this.log('info', `Subscribed to ${symbol}`, symbol);
    });
    
    // Register tick handler
    derivWS.onTick('*', this.handleTick.bind(this));
  }

  public stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    this.log('info', 'Trading engine stopped');
    
    Object.values(DERIV_CONFIG.SYMBOLS).forEach(symbol => {
      derivWS.unsubscribeTicks(symbol);
    });
  }

  private handleTick(tick: TickUpdate) {
    if (!this.isRunning) return;
    
    // Update price history
    const history = this.priceHistory.get(tick.symbol) || [];
    history.push(tick.quote);
    
    // Keep only last N prices
    if (history.length > this.HISTORY_SIZE) {
      history.shift();
    }
    
    this.priceHistory.set(tick.symbol, history);
    
    // Update active trades
    this.updateActiveTrades(tick);
    
    // Analyze for signals (only if we have enough data)
    if (history.length >= 30) {
      this.analyzeSymbol(tick.symbol, tick.quote);
    }
  }

  private updateActiveTrades(tick: TickUpdate) {
    this.activeTrades.forEach((trade, id) => {
      if (trade.symbol === tick.symbol && trade.status === 'open') {
        trade.currentPrice = tick.quote;
        
        // Calculate P/L
        const priceDiff = tick.quote - trade.entryPrice;
        const direction = trade.direction === 'LONG' ? 1 : -1;
        trade.profit = priceDiff * direction * 100; // Simplified P/L calculation
        
        this.tradeHandlers.forEach(h => h(trade));
      }
    });
    
    this.updateStats();
  }

  private analyzeSymbol(symbol: string, currentPrice: number) {
    if (this.stats.isPaused) return;
    
    const history = this.priceHistory.get(symbol) || [];
    const indicators = calculateAllIndicators(history);
    
    // Calculate probability based on indicators
    const { probability, direction, reasoning } = this.calculateTradeProbability(
      symbol,
      currentPrice,
      indicators
    );
    
    // Apply symbol-specific adjustment
    const adjustment = this.symbolAdjustments.get(symbol) || 0;
    const adjustedProbability = Math.max(0, Math.min(1, probability - adjustment));
    
    // Check if we should generate a signal
    if (adjustedProbability >= DERIV_CONFIG.MIN_PROBABILITY) {
      const signal: TradeSignal = {
        symbol,
        direction,
        probability: adjustedProbability,
        reasoning,
        indicators,
        timestamp: Date.now(),
      };
      
      this.log('signal', reasoning, symbol, { probability: adjustedProbability, direction });
      this.signalHandlers.forEach(h => h(signal));
      
      // Execute trade if conditions are met
      if (!this.activeTrades.has(`${symbol}_${direction}`)) {
        this.executeTrade(signal);
      }
    }
  }

  private calculateTradeProbability(
    symbol: string,
    price: number,
    indicators: IndicatorResult
  ): { probability: number; direction: 'LONG' | 'SHORT'; reasoning: string } {
    let longScore = 0;
    let shortScore = 0;
    const reasons: string[] = [];

    // RSI Analysis
    if (indicators.rsi !== null) {
      if (indicators.rsi < DERIV_CONFIG.INDICATORS.RSI_OVERSOLD) {
        longScore += 0.25;
        reasons.push(`RSI oversold (${indicators.rsi.toFixed(1)})`);
      } else if (indicators.rsi > DERIV_CONFIG.INDICATORS.RSI_OVERBOUGHT) {
        shortScore += 0.25;
        reasons.push(`RSI overbought (${indicators.rsi.toFixed(1)})`);
      } else if (indicators.rsi > 50) {
        longScore += 0.1;
      } else {
        shortScore += 0.1;
      }
    }

    // ADX Trend Strength
    if (indicators.adx !== null) {
      if (indicators.adx > DERIV_CONFIG.INDICATORS.ADX_TREND_THRESHOLD) {
        const trendBonus = Math.min(0.2, (indicators.adx - 25) / 100);
        if (longScore > shortScore) {
          longScore += trendBonus;
        } else {
          shortScore += trendBonus;
        }
        reasons.push(`Strong trend (ADX: ${indicators.adx.toFixed(1)})`);
      }
    }

    // Bollinger Bands
    if (indicators.bollingerUpper !== null && indicators.bollingerLower !== null) {
      const bandwidth = indicators.bollingerUpper - indicators.bollingerLower;
      const position = (price - indicators.bollingerLower) / bandwidth;
      
      if (position < 0.1) {
        longScore += 0.2;
        reasons.push('Price at lower Bollinger Band');
      } else if (position > 0.9) {
        shortScore += 0.2;
        reasons.push('Price at upper Bollinger Band');
      }
    }

    // MACD
    if (indicators.macd !== null) {
      if (indicators.macd.histogram > 0 && indicators.macd.macd > indicators.macd.signal) {
        longScore += 0.15;
        reasons.push('MACD bullish crossover');
      } else if (indicators.macd.histogram < 0 && indicators.macd.macd < indicators.macd.signal) {
        shortScore += 0.15;
        reasons.push('MACD bearish crossover');
      }
    }

    // SMA/EMA Analysis
    if (indicators.sma !== null && indicators.ema !== null) {
      if (price > indicators.sma && indicators.ema > indicators.sma) {
        longScore += 0.1;
        reasons.push('Price above SMA, EMA above SMA');
      } else if (price < indicators.sma && indicators.ema < indicators.sma) {
        shortScore += 0.1;
        reasons.push('Price below SMA, EMA below SMA');
      }
    }

    const direction = longScore >= shortScore ? 'LONG' : 'SHORT';
    const maxScore = Math.max(longScore, shortScore);
    const probability = Math.min(0.95, maxScore + 0.4); // Base probability + indicator score
    
    const reasoning = `${symbol}: ${direction} signal - ${reasons.join(', ')} | P=${(probability * 100).toFixed(0)}%`;
    
    return { probability, direction, reasoning };
  }

  private async executeTrade(signal: TradeSignal) {
    const tradeId = `${signal.symbol}_${signal.direction}_${Date.now()}`;
    
    const trade: Trade = {
      id: tradeId,
      symbol: signal.symbol,
      direction: signal.direction,
      entryPrice: 0, // Will be set on confirmation
      currentPrice: 0,
      stake: this.stake,
      profit: 0,
      status: 'pending',
      openTime: Date.now(),
    };
    
    this.activeTrades.set(tradeId, trade);
    this.log('trade', `Opening ${signal.direction} position on ${signal.symbol} @ ${this.stake} USD`, signal.symbol);
    
    const contractType = signal.direction === 'LONG' ? 'CALL' : 'PUT';
    
    try {
      const result = await derivWS.buyContract(
        signal.symbol as any,
        contractType,
        this.stake,
        5, // 5 ticks duration
        't'
      );
      
      if (result.success) {
        trade.status = 'open';
        trade.entryPrice = this.priceHistory.get(signal.symbol)?.slice(-1)[0] || 0;
        this.log('trade', `Trade opened: ${result.contractId}`, signal.symbol);
      } else {
        trade.status = 'closed';
        this.activeTrades.delete(tradeId);
        this.log('error', `Trade failed: ${result.error}`, signal.symbol);
      }
    } catch (error) {
      trade.status = 'closed';
      this.activeTrades.delete(tradeId);
      this.log('error', `Trade execution error: ${error}`, signal.symbol);
    }
    
    this.updateStats();
  }

  public closeTrade(tradeId: string, result: 'win' | 'loss', profit: number) {
    const trade = this.activeTrades.get(tradeId);
    if (!trade) return;
    
    trade.status = 'closed';
    trade.closeTime = Date.now();
    trade.result = result;
    trade.profit = profit;
    
    this.tradeJournal.push(trade);
    this.activeTrades.delete(tradeId);
    
    // Update stats
    this.stats.totalTrades++;
    if (result === 'win') {
      this.stats.wins++;
      this.log('trade', `WIN: +${profit.toFixed(2)} USD on ${trade.symbol}`, trade.symbol);
    } else {
      this.stats.losses++;
      this.log('trade', `LOSS: ${profit.toFixed(2)} USD on ${trade.symbol}`, trade.symbol);
      
      // Adaptive learning - tighten requirements for losing symbol
      const currentAdj = this.symbolAdjustments.get(trade.symbol) || 0;
      this.symbolAdjustments.set(trade.symbol, currentAdj + 0.02); // +2%
      this.log('ai', `Tightening entry for ${trade.symbol} by 2%`, trade.symbol);
    }
    
    this.stats.totalProfit += profit;
    this.stats.winRate = this.stats.totalTrades > 0 
      ? this.stats.wins / this.stats.totalTrades 
      : 0;
    
    // Check for performance floor
    if (this.stats.totalTrades >= 10 && this.stats.winRate < DERIV_CONFIG.WIN_RATE_FLOOR) {
      this.pauseForCalibration();
    }
    
    this.updateStats();
  }

  private pauseForCalibration() {
    this.stats.isPaused = true;
    this.stats.pauseReason = 'Market Calibration - Win rate below threshold';
    
    this.log('warning', 'PAUSED: Win rate below 65%. Running market calibration...', undefined);
    
    // Reset symbol adjustments
    this.symbolAdjustments.clear();
    
    setTimeout(() => {
      this.stats.isPaused = false;
      this.stats.pauseReason = undefined;
      this.log('info', 'Calibration complete. Resuming trading...', undefined);
      this.updateStats();
    }, DERIV_CONFIG.CALIBRATION_PAUSE_MS);
    
    this.updateStats();
  }

  private updateStats() {
    this.stats.activeTradesCount = this.activeTrades.size;
    this.statsHandlers.forEach(h => h({ ...this.stats }));
  }

  private log(type: LogEntry['type'], message: string, symbol?: string, data?: any) {
    const entry: LogEntry = {
      timestamp: Date.now(),
      type,
      symbol,
      message,
      data,
    };
    
    this.logHandlers.forEach(h => h(entry));
  }

  // Public API
  public onLog(handler: LogHandler) {
    this.logHandlers.push(handler);
  }

  public onStats(handler: StatsHandler) {
    this.statsHandlers.push(handler);
    handler({ ...this.stats });
  }

  public onSignal(handler: SignalHandler) {
    this.signalHandlers.push(handler);
  }

  public onTrade(handler: TradeHandler) {
    this.tradeHandlers.push(handler);
  }

  public setStake(stake: number) {
    this.stake = Math.max(DERIV_CONFIG.DEFAULT_STAKE, Math.min(DERIV_CONFIG.MAX_STAKE, stake));
    this.log('info', `Stake updated to ${this.stake} USD`);
  }

  public getActiveTrades(): Trade[] {
    return Array.from(this.activeTrades.values());
  }

  public getTradeJournal(): Trade[] {
    return [...this.tradeJournal];
  }

  public getStats(): TradingStats {
    return { ...this.stats };
  }

  public isActive(): boolean {
    return this.isRunning;
  }
}

// Singleton instance
export const tradingEngine = new TradingEngine();
