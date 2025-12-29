// Deriv API Configuration
// Note: For production, sensitive tokens should be stored in backend secrets

export const DERIV_CONFIG: {
  WS_URL: string;
  API_TOKEN: string;
  APP_ID: number;
  SYMBOLS: Record<string, string>;
  DEFAULT_STAKE: number;
  MAX_STAKE: number;
  MIN_PROBABILITY: number;
  STOP_LOSS_PERCENT: number;
  WIN_RATE_FLOOR: number;
  CALIBRATION_PAUSE_MS: number;
  INDICATORS: {
    RSI_PERIOD: number;
    RSI_OVERBOUGHT: number;
    RSI_OVERSOLD: number;
    ADX_PERIOD: number;
    ADX_TREND_THRESHOLD: number;
    BOLLINGER_PERIOD: number;
    BOLLINGER_STD_DEV: number;
  };
} = {
  WS_URL: 'wss://ws.binaryws.com/websockets/v3',
  API_TOKEN: import.meta.env.VITE_DERIV_TOKEN || 'bwQm6CfYuKyOduN',
  APP_ID: 1089,
  SYMBOLS: {
    VOLATILITY_10: 'R_10',
    VOLATILITY_25: 'R_25',
    VOLATILITY_50: 'R_50',
    VOLATILITY_75: 'R_75',
    VOLATILITY_100: 'R_100',
    VOLATILITY_1HZ_100: '1HZ100V',
  },
  DEFAULT_STAKE: 1.00,
  MAX_STAKE: 100.00,
  MIN_PROBABILITY: 0.75,
  STOP_LOSS_PERCENT: 0.05,
  WIN_RATE_FLOOR: 0.65,
  CALIBRATION_PAUSE_MS: 60000,
  INDICATORS: {
    RSI_PERIOD: 14,
    RSI_OVERBOUGHT: 70,
    RSI_OVERSOLD: 30,
    ADX_PERIOD: 14,
    ADX_TREND_THRESHOLD: 25,
    BOLLINGER_PERIOD: 20,
    BOLLINGER_STD_DEV: 2,
  },
};

export type SymbolKey = keyof typeof DERIV_CONFIG.SYMBOLS;
export type SymbolValue = string;
