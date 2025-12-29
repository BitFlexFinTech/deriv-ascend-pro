// Trade Execution Queue with Rate Limiting and Throttling

import { derivWS, TradeResult } from './deriv-websocket';
import { SymbolValue } from '@/config/deriv';

export interface QueuedTrade {
  id: string;
  symbol: SymbolValue;
  contractType: 'CALL' | 'PUT';
  amount: number;
  duration: number;
  durationUnit: 't' | 's' | 'm' | 'h' | 'd';
  priority: number;
  addedAt: number;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'cancelled';
  resolve: (result: TradeResult) => void;
  reject: (error: Error) => void;
}

export interface QueueStats {
  queueSize: number;
  pendingSymbols: string[];
  isThrottled: boolean;
  throttleEndsAt: number | null;
  lastExecutionTime: number | null;
}

type QueueStatsHandler = (stats: QueueStats) => void;
type ThrottleHandler = (message: string) => void;

class TradeQueue {
  private queue: QueuedTrade[] = [];
  private pendingSymbols: Set<string> = new Set();
  private symbolCooldowns: Map<string, number> = new Map();
  private isProcessing = false;
  private isThrottled = false;
  private throttleEndsAt: number | null = null;
  private lastExecutionTime: number | null = null;
  
  private statsHandlers: QueueStatsHandler[] = [];
  private throttleHandlers: ThrottleHandler[] = [];
  
  // Configuration
  private readonly MIN_EXECUTION_INTERVAL_MS = 2000; // 1 buy per 2 seconds
  private readonly COOLDOWN_PER_ASSET_MS = 60000; // 60 seconds cooldown per asset
  private readonly RATE_LIMIT_BACKOFF_MS = 5000; // 5 seconds backoff on rate limit
  
  constructor() {
    // Start the queue processor
    this.processLoop();
  }
  
  public addTrade(
    symbol: SymbolValue,
    contractType: 'CALL' | 'PUT',
    amount: number,
    duration: number = 5,
    durationUnit: 't' | 's' | 'm' | 'h' | 'd' = 't',
    priority: number = 0
  ): Promise<TradeResult> {
    return new Promise((resolve, reject) => {
      const tradeId = `${symbol}_${contractType}_${Date.now()}`;
      
      // Check if this symbol already has a pending request (debouncing)
      if (this.pendingSymbols.has(symbol)) {
        this.notifyThrottle(`Signal debounced: ${symbol} already has pending request`);
        resolve({
          success: false,
          error: 'Trade already pending for this symbol',
        });
        return;
      }
      
      // Check cooldown for this asset
      const cooldownEnd = this.symbolCooldowns.get(symbol);
      if (cooldownEnd && Date.now() < cooldownEnd) {
        const remainingMs = cooldownEnd - Date.now();
        this.notifyThrottle(`Cooldown active: ${symbol} blocked for ${Math.ceil(remainingMs / 1000)}s`);
        resolve({
          success: false,
          error: `Asset on cooldown. ${Math.ceil(remainingMs / 1000)}s remaining`,
        });
        return;
      }
      
      const trade: QueuedTrade = {
        id: tradeId,
        symbol,
        contractType,
        amount,
        duration,
        durationUnit,
        priority,
        addedAt: Date.now(),
        status: 'pending',
        resolve,
        reject,
      };
      
      // Add to queue sorted by priority (higher priority first), then by time (FIFO)
      this.queue.push(trade);
      this.queue.sort((a, b) => {
        // First by priority (descending)
        if (b.priority !== a.priority) return b.priority - a.priority;
        // Then by addedAt (ascending - FIFO)
        return a.addedAt - b.addedAt;
      });
      
      // Mark symbol as pending
      this.pendingSymbols.add(symbol);
      
      this.updateStats();
    });
  }
  
  private async processLoop() {
    while (true) {
      await this.sleep(100); // Check every 100ms
      
      if (this.isProcessing || this.queue.length === 0) continue;
      if (this.isThrottled && Date.now() < (this.throttleEndsAt || 0)) continue;
      
      // Reset throttle if expired
      if (this.isThrottled && Date.now() >= (this.throttleEndsAt || 0)) {
        this.isThrottled = false;
        this.throttleEndsAt = null;
        this.notifyThrottle('Throttle ended. Resuming execution...');
        this.updateStats();
      }
      
      // Check if enough time has passed since last execution
      if (this.lastExecutionTime && Date.now() - this.lastExecutionTime < this.MIN_EXECUTION_INTERVAL_MS) {
        continue;
      }
      
      const trade = this.queue.shift();
      if (!trade) continue;
      
      this.isProcessing = true;
      
      try {
        await this.executeTrade(trade);
      } catch (error) {
        console.error('[TradeQueue] Execution error:', error);
        trade.status = 'failed';
        trade.resolve({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      } finally {
        this.isProcessing = false;
        this.pendingSymbols.delete(trade.symbol);
        this.updateStats();
      }
    }
  }
  
  private async executeTrade(trade: QueuedTrade) {
    trade.status = 'executing';
    
    try {
      const result = await derivWS.buyContract(
        trade.symbol,
        trade.contractType,
        trade.amount,
        trade.duration,
        trade.durationUnit
      );
      
      this.lastExecutionTime = Date.now();
      
      // Check for rate limit error
      if (!result.success && result.error) {
        const errorLower = result.error.toLowerCase();
        if (errorLower.includes('rate limit') || errorLower.includes('too many') || errorLower.includes('throttle')) {
          this.handleRateLimitError();
          trade.status = 'failed';
          trade.resolve(result);
          return;
        }
      }
      
      // Set cooldown for this symbol regardless of success/failure
      this.symbolCooldowns.set(trade.symbol, Date.now() + this.COOLDOWN_PER_ASSET_MS);
      
      trade.status = result.success ? 'completed' : 'failed';
      trade.resolve(result);
    } catch (error) {
      // Check if error message contains rate limit
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.toLowerCase().includes('rate limit')) {
        this.handleRateLimitError();
      }
      
      trade.status = 'failed';
      trade.resolve({
        success: false,
        error: errorMessage,
      });
    }
  }
  
  private handleRateLimitError() {
    this.notifyThrottle('API THROTTLING: Rate limit detected. Backing off for 5 seconds...');
    
    this.isThrottled = true;
    this.throttleEndsAt = Date.now() + this.RATE_LIMIT_BACKOFF_MS;
    
    // Clear the queue and reject all pending trades
    const cancelledTrades = this.queue.splice(0, this.queue.length);
    cancelledTrades.forEach(trade => {
      trade.status = 'cancelled';
      this.pendingSymbols.delete(trade.symbol);
      trade.resolve({
        success: false,
        error: 'Trade cancelled due to rate limit backoff',
      });
    });
    
    this.notifyThrottle(`Queue cleared: ${cancelledTrades.length} trades cancelled`);
    this.updateStats();
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  private updateStats() {
    const stats: QueueStats = {
      queueSize: this.queue.length,
      pendingSymbols: Array.from(this.pendingSymbols),
      isThrottled: this.isThrottled,
      throttleEndsAt: this.throttleEndsAt,
      lastExecutionTime: this.lastExecutionTime,
    };
    
    this.statsHandlers.forEach(handler => handler(stats));
  }
  
  private notifyThrottle(message: string) {
    this.throttleHandlers.forEach(handler => handler(message));
  }
  
  // Public API
  public onStats(handler: QueueStatsHandler) {
    this.statsHandlers.push(handler);
    this.updateStats();
  }
  
  public offStats(handler: QueueStatsHandler) {
    const index = this.statsHandlers.indexOf(handler);
    if (index > -1) {
      this.statsHandlers.splice(index, 1);
    }
  }
  
  public onThrottle(handler: ThrottleHandler) {
    this.throttleHandlers.push(handler);
  }
  
  public offThrottle(handler: ThrottleHandler) {
    const index = this.throttleHandlers.indexOf(handler);
    if (index > -1) {
      this.throttleHandlers.splice(index, 1);
    }
  }
  
  public getStats(): QueueStats {
    return {
      queueSize: this.queue.length,
      pendingSymbols: Array.from(this.pendingSymbols),
      isThrottled: this.isThrottled,
      throttleEndsAt: this.throttleEndsAt,
      lastExecutionTime: this.lastExecutionTime,
    };
  }
  
  public getQueueSize(): number {
    return this.queue.length;
  }
  
  public isInCooldown(symbol: string): boolean {
    const cooldownEnd = this.symbolCooldowns.get(symbol);
    return cooldownEnd ? Date.now() < cooldownEnd : false;
  }
  
  public getCooldownRemaining(symbol: string): number {
    const cooldownEnd = this.symbolCooldowns.get(symbol);
    if (!cooldownEnd) return 0;
    return Math.max(0, cooldownEnd - Date.now());
  }
  
  public clearQueue() {
    const cancelledTrades = this.queue.splice(0, this.queue.length);
    cancelledTrades.forEach(trade => {
      trade.status = 'cancelled';
      this.pendingSymbols.delete(trade.symbol);
      trade.resolve({
        success: false,
        error: 'Trade cancelled manually',
      });
    });
    this.updateStats();
  }
}

// Singleton instance
export const tradeQueue = new TradeQueue();
