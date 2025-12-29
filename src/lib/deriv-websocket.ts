import { DERIV_CONFIG, SymbolValue } from '@/config/deriv';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'authorized' | 'error';

export interface TickUpdate {
  symbol: string;
  quote: number;
  epoch: number;
}

export interface TradeResult {
  success: boolean;
  contractId?: string;
  buyPrice?: number;
  error?: string;
  profit?: number;
}

export interface ContractUpdate {
  contractId: string;
  symbol: string;
  buyPrice: number;
  bidPrice: number;
  profit: number;
  payout: number;
  isSold: boolean;
  isExpired: boolean;
  isSettled: boolean;
  sellPrice?: number;
  sellTime?: number;
  status: 'open' | 'sold' | 'expired' | 'won' | 'lost';
}

export interface AccountInfo {
  currency: string;
  balance: number;
  loginid: string;
}

export type MessageHandler = (data: any) => void;
export type TickHandler = (tick: TickUpdate) => void;
export type StatusHandler = (status: ConnectionStatus) => void;
export type ContractHandler = (update: ContractUpdate) => void;

class DerivWebSocket {
  private ws: WebSocket | null = null;
  private messageHandlers: Map<string, MessageHandler[]> = new Map();
  private tickHandlers: Map<string, TickHandler[]> = new Map();
  private contractHandlers: Map<string, ContractHandler[]> = new Map();
  private statusHandlers: StatusHandler[] = [];
  private status: ConnectionStatus = 'disconnected';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private pingInterval: NodeJS.Timeout | null = null;
  private subscriptions: Set<string> = new Set();
  private contractSubscriptions: Map<string, string> = new Map(); // contractId -> subscriptionId
  
  // Dynamic currency from account
  private accountCurrency: string = 'USD';
  private accountInfo: AccountInfo | null = null;

  constructor() {
    this.connect();
  }

  private connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    
    this.setStatus('connecting');
    
    const url = `${DERIV_CONFIG.WS_URL}?app_id=${DERIV_CONFIG.APP_ID}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('[WS] Connected to Deriv');
      this.setStatus('connected');
      this.reconnectAttempts = 0;
      this.authorize();
      this.startPing();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (error) {
        console.error('[WS] Parse error:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('[WS] Error:', error);
      this.setStatus('error');
    };

    this.ws.onclose = () => {
      console.log('[WS] Disconnected');
      this.setStatus('disconnected');
      this.stopPing();
      this.attemptReconnect();
    };
  }

  private authorize() {
    if (DERIV_CONFIG.API_TOKEN) {
      this.send({
        authorize: DERIV_CONFIG.API_TOKEN,
      });
    }
  }

  private startPing() {
    this.pingInterval = setInterval(() => {
      this.send({ ping: 1 });
    }, 30000);
  }

  private stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WS] Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  private handleMessage(data: any) {
    // Handle authorization - extract account currency
    if (data.authorize) {
      console.log('[WS] Authorized successfully');
      
      // Extract currency from authorize response
      if (data.authorize.currency) {
        this.accountCurrency = data.authorize.currency;
        console.log(`[WS] Account currency detected: ${this.accountCurrency}`);
      }
      
      this.accountInfo = {
        currency: data.authorize.currency || 'USD',
        balance: data.authorize.balance || 0,
        loginid: data.authorize.loginid || '',
      };
      
      this.setStatus('authorized');
      this.resubscribe();
      
      // Also fetch settings for additional account info
      this.send({ get_settings: 1 });
    }
    
    // Handle get_settings response for currency fallback
    if (data.get_settings) {
      if (data.get_settings.preferred_language) {
        console.log('[WS] Settings received');
      }
    }

    // Handle ticks
    if (data.tick) {
      const tick: TickUpdate = {
        symbol: data.tick.symbol,
        quote: data.tick.quote,
        epoch: data.tick.epoch,
      };
      
      const handlers = this.tickHandlers.get(tick.symbol) || [];
      handlers.forEach(handler => handler(tick));
      
      // Also call global tick handlers
      const globalHandlers = this.tickHandlers.get('*') || [];
      globalHandlers.forEach(handler => handler(tick));
    }

    // Handle proposal_open_contract updates (contract lifecycle)
    if (data.proposal_open_contract) {
      const poc = data.proposal_open_contract;
      const contractId = String(poc.contract_id);
      
      // Store subscription ID for later unsubscription
      if (data.subscription?.id) {
        this.contractSubscriptions.set(contractId, data.subscription.id);
      }
      
      const update: ContractUpdate = {
        contractId,
        symbol: poc.underlying || '',
        buyPrice: poc.buy_price || 0,
        bidPrice: poc.bid_price || 0,
        profit: poc.profit || 0,
        payout: poc.payout || 0,
        isSold: poc.is_sold === 1,
        isExpired: poc.is_expired === 1,
        isSettled: poc.is_settleable === 1 || poc.is_sold === 1 || poc.is_expired === 1,
        sellPrice: poc.sell_price,
        sellTime: poc.sell_time,
        status: this.determineContractStatus(poc),
      };
      
      // Call handlers for this specific contract
      const contractHandlers = this.contractHandlers.get(contractId) || [];
      contractHandlers.forEach(handler => handler(update));
      
      // Call global contract handlers
      const globalContractHandlers = this.contractHandlers.get('*') || [];
      globalContractHandlers.forEach(handler => handler(update));
    }

    // Handle errors
    if (data.error) {
      console.error('[WS] API Error:', data.error.message);
    }

    // Call message handlers
    const msgType = data.msg_type;
    if (msgType) {
      const handlers = this.messageHandlers.get(msgType) || [];
      handlers.forEach(handler => handler(data));
      
      // Global handlers
      const globalHandlers = this.messageHandlers.get('*') || [];
      globalHandlers.forEach(handler => handler(data));
    }
  }

  private determineContractStatus(poc: any): ContractUpdate['status'] {
    if (poc.is_sold === 1) return 'sold';
    if (poc.is_expired === 1) {
      return poc.profit >= 0 ? 'won' : 'lost';
    }
    return 'open';
  }

  private resubscribe() {
    // Resubscribe to all symbols after reconnection
    this.subscriptions.forEach(symbol => {
      this.send({
        ticks: symbol,
        subscribe: 1,
      });
    });
  }

  private setStatus(status: ConnectionStatus) {
    this.status = status;
    this.statusHandlers.forEach(handler => handler(status));
  }

  public send(data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('[WS] Cannot send - not connected');
    }
  }

  public subscribeTicks(symbol: SymbolValue) {
    this.subscriptions.add(symbol);
    this.send({
      ticks: symbol,
      subscribe: 1,
    });
  }

  public unsubscribeTicks(symbol: SymbolValue) {
    this.subscriptions.delete(symbol);
    this.send({
      forget_all: 'ticks',
    });
    // Resubscribe to remaining symbols
    this.subscriptions.forEach(s => {
      this.send({
        ticks: s,
        subscribe: 1,
      });
    });
  }

  // Subscribe to contract updates for a specific contract
  public subscribeOpenContract(contractId: string, handler: ContractHandler) {
    // Register handler
    const handlers = this.contractHandlers.get(contractId) || [];
    handlers.push(handler);
    this.contractHandlers.set(contractId, handlers);
    
    // Send subscription request
    this.send({
      proposal_open_contract: 1,
      contract_id: contractId,
      subscribe: 1,
    });
    
    console.log(`[WS] Subscribed to contract updates: ${contractId}`);
  }

  // Unsubscribe from contract updates
  public unsubscribeOpenContract(contractId: string) {
    const subscriptionId = this.contractSubscriptions.get(contractId);
    if (subscriptionId) {
      this.send({
        forget: subscriptionId,
      });
      this.contractSubscriptions.delete(contractId);
    }
    this.contractHandlers.delete(contractId);
    console.log(`[WS] Unsubscribed from contract: ${contractId}`);
  }

  // Register global contract handler
  public onContractUpdate(handler: ContractHandler) {
    const handlers = this.contractHandlers.get('*') || [];
    handlers.push(handler);
    this.contractHandlers.set('*', handlers);
  }

  // Sell a contract at market price
  public async sellContract(contractId: string, price: number = 0): Promise<TradeResult> {
    return new Promise((resolve) => {
      const reqId = Date.now();
      
      const handler = (data: any) => {
        if (data.sell) {
          resolve({
            success: true,
            contractId: String(data.sell.contract_id),
            profit: data.sell.sold_for - (data.sell.buy_price || 0),
          });
        } else if (data.error) {
          resolve({
            success: false,
            error: data.error.message,
          });
        }
        // Remove handler after response
        const handlers = this.messageHandlers.get('sell') || [];
        const idx = handlers.indexOf(handler);
        if (idx > -1) handlers.splice(idx, 1);
      };

      this.onMessage('sell', handler);

      this.send({
        sell: contractId,
        price: price, // 0 = market price
        req_id: reqId,
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        resolve({
          success: false,
          error: 'Sell contract timeout',
        });
      }, 10000);
    });
  }

  public onTick(symbol: string, handler: TickHandler) {
    const handlers = this.tickHandlers.get(symbol) || [];
    handlers.push(handler);
    this.tickHandlers.set(symbol, handlers);
  }

  public offTick(symbol: string, handler: TickHandler) {
    const handlers = this.tickHandlers.get(symbol) || [];
    const index = handlers.indexOf(handler);
    if (index > -1) {
      handlers.splice(index, 1);
      this.tickHandlers.set(symbol, handlers);
    }
  }

  public onMessage(msgType: string, handler: MessageHandler) {
    const handlers = this.messageHandlers.get(msgType) || [];
    handlers.push(handler);
    this.messageHandlers.set(msgType, handlers);
  }

  public onStatusChange(handler: StatusHandler) {
    this.statusHandlers.push(handler);
    // Immediately call with current status
    handler(this.status);
  }

  public offStatusChange(handler: StatusHandler) {
    const index = this.statusHandlers.indexOf(handler);
    if (index > -1) {
      this.statusHandlers.splice(index, 1);
    }
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }
  
  public getAccountCurrency(): string {
    return this.accountCurrency;
  }
  
  public getAccountInfo(): AccountInfo | null {
    return this.accountInfo;
  }

  public async buyContract(
    symbol: SymbolValue,
    contractType: 'CALL' | 'PUT',
    amount: number,
    duration: number = 5,
    durationUnit: 't' | 's' | 'm' | 'h' | 'd' = 't'
  ): Promise<TradeResult> {
    return new Promise((resolve) => {
      const reqId = Date.now();
      
      const handler = (data: any) => {
        if (data.buy) {
          resolve({
            success: true,
            contractId: String(data.buy.contract_id),
            buyPrice: data.buy.buy_price,
          });
        } else if (data.error) {
          resolve({
            success: false,
            error: data.error.message,
          });
        }
        this.messageHandlers.delete(`buy_${reqId}`);
      };

      this.onMessage('buy', handler);

      // Use dynamic currency from account instead of hardcoded USD
      const currency = this.accountCurrency;
      console.log(`[WS] Executing buy with currency: ${currency}`);

      this.send({
        buy: 1,
        price: amount,
        parameters: {
          contract_type: contractType,
          symbol: symbol,
          duration: duration,
          duration_unit: durationUnit,
          basis: 'stake',
          amount: amount,
          currency: currency, // Dynamic currency from account
        },
        req_id: reqId,
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        resolve({
          success: false,
          error: 'Trade execution timeout',
        });
      }, 10000);
    });
  }

  public getBalance() {
    this.send({ balance: 1, subscribe: 1 });
  }

  public getActiveContracts() {
    this.send({ portfolio: 1 });
  }

  public disconnect() {
    this.stopPing();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// Singleton instance
export const derivWS = new DerivWebSocket();
