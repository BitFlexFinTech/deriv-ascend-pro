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
  error?: string;
  profit?: number;
}

export interface AccountInfo {
  currency: string;
  balance: number;
  loginid: string;
}

export type MessageHandler = (data: any) => void;
export type TickHandler = (tick: TickUpdate) => void;
export type StatusHandler = (status: ConnectionStatus) => void;

class DerivWebSocket {
  private ws: WebSocket | null = null;
  private messageHandlers: Map<string, MessageHandler[]> = new Map();
  private tickHandlers: Map<string, TickHandler[]> = new Map();
  private statusHandlers: StatusHandler[] = [];
  private status: ConnectionStatus = 'disconnected';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private pingInterval: NodeJS.Timeout | null = null;
  private subscriptions: Set<string> = new Set();
  
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
            contractId: data.buy.contract_id,
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
