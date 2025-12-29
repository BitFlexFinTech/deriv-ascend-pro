// Technical Indicators Library

export interface TickData {
  epoch: number;
  quote: number;
  symbol: string;
}

export interface IndicatorResult {
  rsi: number | null;
  adx: number | null;
  bollingerUpper: number | null;
  bollingerMiddle: number | null;
  bollingerLower: number | null;
  sma: number | null;
  ema: number | null;
  macd: { macd: number; signal: number; histogram: number } | null;
  atr: number | null;
}

// Calculate Simple Moving Average
export function calculateSMA(data: number[], period: number): number | null {
  if (data.length < period) return null;
  const slice = data.slice(-period);
  return slice.reduce((sum, val) => sum + val, 0) / period;
}

// Calculate Exponential Moving Average
export function calculateEMA(data: number[], period: number): number | null {
  if (data.length < period) return null;
  
  const multiplier = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((sum, val) => sum + val, 0) / period;
  
  for (let i = period; i < data.length; i++) {
    ema = (data[i] - ema) * multiplier + ema;
  }
  
  return ema;
}

// Calculate Relative Strength Index (RSI)
export function calculateRSI(data: number[], period: number = 14): number | null {
  if (data.length < period + 1) return null;
  
  const changes: number[] = [];
  for (let i = 1; i < data.length; i++) {
    changes.push(data[i] - data[i - 1]);
  }
  
  let avgGain = 0;
  let avgLoss = 0;
  
  // Initial average
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i];
    else avgLoss += Math.abs(changes[i]);
  }
  
  avgGain /= period;
  avgLoss /= period;
  
  // Smoothed average
  for (let i = period; i < changes.length; i++) {
    if (changes[i] > 0) {
      avgGain = (avgGain * (period - 1) + changes[i]) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(changes[i])) / period;
    }
  }
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// Calculate Average Directional Index (ADX)
export function calculateADX(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): number | null {
  if (highs.length < period * 2) return null;
  
  const trueRanges: number[] = [];
  const plusDM: number[] = [];
  const minusDM: number[] = [];
  
  for (let i = 1; i < highs.length; i++) {
    const highDiff = highs[i] - highs[i - 1];
    const lowDiff = lows[i - 1] - lows[i];
    
    plusDM.push(highDiff > lowDiff && highDiff > 0 ? highDiff : 0);
    minusDM.push(lowDiff > highDiff && lowDiff > 0 ? lowDiff : 0);
    
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    trueRanges.push(tr);
  }
  
  // Smoothed averages
  let smoothedTR = trueRanges.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothedPlusDM = plusDM.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothedMinusDM = minusDM.slice(0, period).reduce((a, b) => a + b, 0);
  
  const dx: number[] = [];
  
  for (let i = period; i < trueRanges.length; i++) {
    smoothedTR = smoothedTR - (smoothedTR / period) + trueRanges[i];
    smoothedPlusDM = smoothedPlusDM - (smoothedPlusDM / period) + plusDM[i];
    smoothedMinusDM = smoothedMinusDM - (smoothedMinusDM / period) + minusDM[i];
    
    const plusDI = (smoothedPlusDM / smoothedTR) * 100;
    const minusDI = (smoothedMinusDM / smoothedTR) * 100;
    const diDiff = Math.abs(plusDI - minusDI);
    const diSum = plusDI + minusDI;
    
    if (diSum > 0) {
      dx.push((diDiff / diSum) * 100);
    }
  }
  
  if (dx.length < period) return null;
  
  // ADX is smoothed DX
  let adx = dx.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < dx.length; i++) {
    adx = ((adx * (period - 1)) + dx[i]) / period;
  }
  
  return adx;
}

// Calculate Bollinger Bands
export function calculateBollingerBands(
  data: number[],
  period: number = 20,
  stdDev: number = 2
): { upper: number; middle: number; lower: number } | null {
  if (data.length < period) return null;
  
  const slice = data.slice(-period);
  const middle = slice.reduce((sum, val) => sum + val, 0) / period;
  
  const squaredDiffs = slice.map(val => Math.pow(val - middle, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / period;
  const standardDeviation = Math.sqrt(variance);
  
  return {
    upper: middle + (standardDeviation * stdDev),
    middle,
    lower: middle - (standardDeviation * stdDev),
  };
}

// Calculate MACD
export function calculateMACD(
  data: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): { macd: number; signal: number; histogram: number } | null {
  if (data.length < slowPeriod + signalPeriod) return null;
  
  const fastEMA = calculateEMA(data, fastPeriod);
  const slowEMA = calculateEMA(data, slowPeriod);
  
  if (fastEMA === null || slowEMA === null) return null;
  
  const macdLine = fastEMA - slowEMA;
  
  // Calculate MACD values for signal line
  const macdValues: number[] = [];
  for (let i = slowPeriod; i <= data.length; i++) {
    const fast = calculateEMA(data.slice(0, i), fastPeriod);
    const slow = calculateEMA(data.slice(0, i), slowPeriod);
    if (fast !== null && slow !== null) {
      macdValues.push(fast - slow);
    }
  }
  
  const signalLine = calculateEMA(macdValues, signalPeriod);
  if (signalLine === null) return null;
  
  return {
    macd: macdLine,
    signal: signalLine,
    histogram: macdLine - signalLine,
  };
}

// Calculate Average True Range (ATR)
export function calculateATR(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): number | null {
  if (highs.length < period + 1) return null;
  
  const trueRanges: number[] = [];
  
  for (let i = 1; i < highs.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    trueRanges.push(tr);
  }
  
  if (trueRanges.length < period) return null;
  
  let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  for (let i = period; i < trueRanges.length; i++) {
    atr = ((atr * (period - 1)) + trueRanges[i]) / period;
  }
  
  return atr;
}

// Calculate all indicators for a symbol
export function calculateAllIndicators(
  prices: number[],
  highs?: number[],
  lows?: number[]
): IndicatorResult {
  const h = highs || prices;
  const l = lows || prices;
  
  const bollinger = calculateBollingerBands(prices);
  
  return {
    rsi: calculateRSI(prices),
    adx: calculateADX(h, l, prices),
    bollingerUpper: bollinger?.upper || null,
    bollingerMiddle: bollinger?.middle || null,
    bollingerLower: bollinger?.lower || null,
    sma: calculateSMA(prices, 20),
    ema: calculateEMA(prices, 12),
    macd: calculateMACD(prices),
    atr: calculateATR(h, l, prices),
  };
}
