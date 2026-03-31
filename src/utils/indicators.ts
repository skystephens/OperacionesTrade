import type { KlineData } from '../types'

export function calcRSI(klines: KlineData[], period = 14): number {
  if (klines.length < period + 1) return 50
  const closes = klines.map((k) => k.close)
  let gains = 0
  let losses = 0

  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff >= 0) gains += diff
    else losses += Math.abs(diff)
  }

  const avgGain = gains / period
  const avgLoss = losses / period
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

export function calcEMA(values: number[], period: number): number {
  if (values.length < period) return values[values.length - 1] ?? 0
  const k = 2 / (period + 1)
  let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period
  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k)
  }
  return ema
}

export function calcEMAArray(values: number[], period: number): number[] {
  const result: number[] = []
  const k = 2 / (period + 1)
  let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period
  result.push(ema)
  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k)
    result.push(ema)
  }
  return result
}

// ─── MACD ────────────────────────────────────────────────────────────────────
// MACD Line  = EMA(12) − EMA(26)
// Signal     = EMA(9) of MACD Line
// Histogram  = MACD − Signal
// Positive histogram = bullish momentum building
// Negative histogram = bearish momentum building
// Cross above zero = buy signal; cross below zero = sell signal

export interface MACDResult {
  macd: number
  signal: number
  histogram: number
  trend: 'bullish' | 'bearish' | 'neutral'
  crossover: 'bullish_cross' | 'bearish_cross' | null  // signal line cross in last candle
}

export function calcMACD(closes: number[]): MACDResult {
  const empty: MACDResult = { macd: 0, signal: 0, histogram: 0, trend: 'neutral', crossover: null }
  if (closes.length < 35) return empty

  const ema12 = calcEMAArray(closes, 12)
  const ema26 = calcEMAArray(closes, 26)

  // Align: ema12 has 14 more values than ema26
  const offset = ema12.length - ema26.length
  const macdLine = ema26.map((v, i) => ema12[i + offset] - v)
  if (macdLine.length < 9) return empty

  const signalLine = calcEMAArray(macdLine, 9)
  const alignOffset = macdLine.length - signalLine.length

  const lastMACD = macdLine[macdLine.length - 1]
  const lastSignal = signalLine[signalLine.length - 1]
  const prevMACD = macdLine[macdLine.length - 2]
  const prevSignal = signalLine[signalLine.length - 2] ?? lastSignal
  const histogram = lastMACD - lastSignal
  const prevHistogram = prevMACD - prevSignal

  // Detect crossover in the last candle
  let crossover: MACDResult['crossover'] = null
  if (prevHistogram <= 0 && histogram > 0) crossover = 'bullish_cross'
  else if (prevHistogram >= 0 && histogram < 0) crossover = 'bearish_cross'

  const trend: MACDResult['trend'] =
    histogram > 0 && lastMACD > 0 ? 'bullish' :
    histogram < 0 && lastMACD < 0 ? 'bearish' : 'neutral'

  // suppress unused var warning
  void alignOffset

  return { macd: lastMACD, signal: lastSignal, histogram, trend, crossover }
}

// ─── Pivot Point S/R Detection ───────────────────────────────────────────────
// Finds real swing highs/lows using a lookback window.
// A pivot high: the candle's high is the highest in [i-window .. i+window]
// A pivot low:  the candle's low is the lowest in [i-window .. i+window]

function findPivots(klines: KlineData[], window = 3): { supports: number[]; resistances: number[] } {
  const pivotHighs: number[] = []
  const pivotLows: number[] = []

  for (let i = window; i < klines.length - window; i++) {
    const high = klines[i].high
    const low = klines[i].low

    let isPivotHigh = true
    let isPivotLow = true

    for (let j = i - window; j <= i + window; j++) {
      if (j === i) continue
      if (klines[j].high >= high) isPivotHigh = false
      if (klines[j].low <= low) isPivotLow = false
    }

    if (isPivotHigh) pivotHighs.push(high)
    if (isPivotLow) pivotLows.push(low)
  }

  return { supports: pivotLows, resistances: pivotHighs }
}

// Cluster nearby levels (within 0.3% of each other → merge into average)
function clusterLevels(levels: number[], thresholdPct = 0.003): number[] {
  if (levels.length === 0) return []
  const sorted = [...levels].sort((a, b) => a - b)
  const clusters: number[][] = [[sorted[0]]]

  for (let i = 1; i < sorted.length; i++) {
    const last = clusters[clusters.length - 1]
    const avg = last.reduce((a, b) => a + b, 0) / last.length
    if (Math.abs(sorted[i] - avg) / avg < thresholdPct) {
      last.push(sorted[i])
    } else {
      clusters.push([sorted[i]])
    }
  }

  return clusters.map((c) => c.reduce((a, b) => a + b, 0) / c.length)
}

// Returns the N levels closest to price (below for supports, above for resistances)
function getNearestLevels(levels: number[], price: number, side: 'below' | 'above', count = 3): number[] {
  const filtered = side === 'below'
    ? levels.filter((l) => l < price)
    : levels.filter((l) => l > price)

  const sorted = side === 'below'
    ? filtered.sort((a, b) => b - a) // closest below = highest below
    : filtered.sort((a, b) => a - b) // closest above = lowest above

  return sorted.slice(0, count)
}

// ─── Entry Plan ──────────────────────────────────────────────────────────────

export interface EntryPlan {
  direction: 'LONG' | 'SHORT'
  entry: number
  stopLoss: number
  slPercent: number
  takeProfit1: number
  takeProfit2: number
  tp1Percent: number
  tp2Percent: number
  riskReward1: number
  riskReward2: number
  positionSizeEth: number  // based on default $300 capital, 2% risk
  marginRequired: number   // at 15x leverage
  maxLoss: number
  validMinutes: number
  shareText: string
}

function buildEntryPlan(
  direction: 'LONG' | 'SHORT',
  currentPrice: number,
  supports: number[],
  resistances: number[],
  signalScore: number
): EntryPlan {
  const capital = 300
  const riskPct = 0.02
  const leverage = 15

  let entry: number
  let stopLoss: number
  let tp1: number
  let tp2: number

  const s1 = supports[0] ?? currentPrice * 0.985
  const s2 = supports[1] ?? currentPrice * 0.97
  const r1 = resistances[0] ?? currentPrice * 1.015
  const r2 = resistances[1] ?? currentPrice * 1.03

  if (direction === 'LONG') {
    entry = currentPrice
    // SL just below nearest support (with 0.2% buffer)
    stopLoss = s1 * 0.998
    tp1 = r1
    tp2 = r2
  } else {
    entry = currentPrice
    // SL just above nearest resistance (with 0.2% buffer)
    stopLoss = r1 * 1.002
    tp1 = s1
    tp2 = s2
  }

  const slPct = Math.abs(entry - stopLoss) / entry
  const tp1Pct = Math.abs(tp1 - entry) / entry
  const tp2Pct = Math.abs(tp2 - entry) / entry

  const maxLoss = capital * riskPct
  const positionSizeEth = maxLoss / (entry * slPct)
  const marginRequired = (positionSizeEth * entry) / leverage

  const rr1 = slPct > 0 ? tp1Pct / slPct : 0
  const rr2 = slPct > 0 ? tp2Pct / slPct : 0

  const absScore = Math.abs(signalScore)
  const validMinutes = absScore >= 60 ? 20 : absScore >= 30 ? 30 : 45

  const dir = direction === 'LONG' ? '🟢 COMPRA' : '🔴 VENTA'
  const slSign = direction === 'LONG' ? '-' : '+'
  const tp1Sign = direction === 'LONG' ? '+' : '-'
  const tp2Sign = direction === 'LONG' ? '+' : '-'

  const shareText =
    `${dir} ETH/USDT\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `🎯 Entrada: $${entry.toFixed(2)}\n` +
    `🛑 Stop-Loss: $${stopLoss.toFixed(2)} (${slSign}${(slPct * 100).toFixed(2)}%)\n` +
    `✅ TP1: $${tp1.toFixed(2)} (${tp1Sign}${(tp1Pct * 100).toFixed(2)}%) R:R 1:${rr1.toFixed(1)}\n` +
    `✅ TP2: $${tp2.toFixed(2)} (${tp2Sign}${(tp2Pct * 100).toFixed(2)}%) R:R 1:${rr2.toFixed(1)}\n` +
    `⚡ Apalancamiento: ${leverage}x\n` +
    `💰 Margen sugerido: $${marginRequired.toFixed(2)}\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `📊 Score: ${signalScore > 0 ? '+' : ''}${signalScore} | ⏱ ~${validMinutes} min\n` +
    `⚠️ Siempre usa stop-loss. No es asesoría financiera.`

  return {
    direction,
    entry,
    stopLoss,
    slPercent: slPct * 100,
    takeProfit1: tp1,
    takeProfit2: tp2,
    tp1Percent: tp1Pct * 100,
    tp2Percent: tp2Pct * 100,
    riskReward1: rr1,
    riskReward2: rr2,
    positionSizeEth,
    marginRequired,
    maxLoss,
    validMinutes,
    shareText,
  }
}

// ─── Main Analysis ────────────────────────────────────────────────────────────

export interface AnalysisResult {
  rsi: number
  ema9: number
  ema21: number
  ema50: number
  currentPrice: number
  priceVsEma9: 'above' | 'below'
  priceVsEma21: 'above' | 'below'
  ema9VsEma21: 'above' | 'below'
  volumeTrend: 'increasing' | 'decreasing' | 'neutral'
  // Legacy simple S/R (kept for compatibility)
  support: number
  resistance: number
  // Improved multi-level S/R
  supports: number[]      // up to 3 levels below price, closest first
  resistances: number[]   // up to 3 levels above price, closest first
  signal: 'STRONG_LONG' | 'LONG' | 'NEUTRAL' | 'SHORT' | 'STRONG_SHORT'
  signalScore: number // -100 to 100
  reasons: string[]
  trend: 'ALCISTA' | 'BAJISTA' | 'LATERAL'
  trendStrength: number // 0-100
  macd: MACDResult
  entryPlan: EntryPlan  // always present
}

export function analyzeMarket(klines: KlineData[]): AnalysisResult | null {
  if (klines.length < 55) return null

  const closes = klines.map((k) => k.close)
  const volumes = klines.map((k) => k.volume)
  const currentPrice = closes[closes.length - 1]

  const rsi = calcRSI(klines, 14)
  const macd = calcMACD(closes)
  const ema9 = calcEMA(closes, 9)
  const ema21 = calcEMA(closes, 21)
  const ema50 = calcEMA(closes, 50)

  // ── Improved S/R via pivot points (last 100 candles) ──────────────────────
  const lookback = klines.slice(-100)
  const { supports: rawSupports, resistances: rawResistances } = findPivots(lookback, 3)

  // Also include EMA levels as dynamic S/R
  const allSupports = [...rawSupports, ema21, ema50].filter((l) => l < currentPrice)
  const allResistances = [...rawResistances, ema9].filter((l) => l > currentPrice)

  const clusteredSupports = clusterLevels(allSupports)
  const clusteredResistances = clusterLevels(allResistances)

  const supports = getNearestLevels(clusteredSupports, currentPrice, 'below', 3)
  const resistances = getNearestLevels(clusteredResistances, currentPrice, 'above', 3)

  // Legacy simple S/R (keep for backward compatibility)
  const recent20 = klines.slice(-20)
  const support = supports[0] ?? Math.min(...recent20.map((k) => k.low))
  const resistance = resistances[0] ?? Math.max(...recent20.map((k) => k.high))

  // ── Volume trend ──────────────────────────────────────────────────────────
  const recentVol = volumes.slice(-5).reduce((a, b) => a + b, 0)
  const prevVol = volumes.slice(-10, -5).reduce((a, b) => a + b, 0)
  const volumeTrend: AnalysisResult['volumeTrend'] =
    recentVol > prevVol * 1.1 ? 'increasing' : recentVol < prevVol * 0.9 ? 'decreasing' : 'neutral'

  const priceVsEma9: AnalysisResult['priceVsEma9'] = currentPrice >= ema9 ? 'above' : 'below'
  const priceVsEma21: AnalysisResult['priceVsEma21'] = currentPrice >= ema21 ? 'above' : 'below'
  const ema9VsEma21: AnalysisResult['ema9VsEma21'] = ema9 >= ema21 ? 'above' : 'below'

  // ── Signal score ──────────────────────────────────────────────────────────
  let score = 0
  const reasons: string[] = []

  if (rsi < 30) { score += 30; reasons.push('RSI sobrevendido — posible rebote alcista') }
  else if (rsi > 70) { score -= 30; reasons.push('RSI sobrecomprado — posible corrección bajista') }
  else if (rsi > 55) { score += 10; reasons.push('RSI en zona alcista') }
  else if (rsi < 45) { score -= 10; reasons.push('RSI en zona bajista') }

  if (priceVsEma9 === 'above') { score += 15; reasons.push('Precio sobre EMA 9 — impulso alcista') }
  else { score -= 15; reasons.push('Precio bajo EMA 9 — impulso bajista') }

  if (priceVsEma21 === 'above') { score += 15; reasons.push('Precio sobre EMA 21 — tendencia alcista') }
  else { score -= 15; reasons.push('Precio bajo EMA 21 — tendencia bajista') }

  if (ema9VsEma21 === 'above') { score += 20; reasons.push('EMA 9 > EMA 21 — Golden cross activo') }
  else { score -= 20; reasons.push('EMA 9 < EMA 21 — Death cross activo') }

  if (volumeTrend === 'increasing') { score > 0 ? score += 10 : (score -= 10); reasons.push('Volumen aumentando — confirma movimiento') }
  else if (volumeTrend === 'decreasing') { reasons.push('Volumen bajo — movimiento sin conviccion') }

  // MACD contribution
  if (macd.crossover === 'bullish_cross') { score += 20; reasons.push('MACD cruzó al alza — momentum alcista confirmado') }
  else if (macd.crossover === 'bearish_cross') { score -= 20; reasons.push('MACD cruzó a la baja — momentum bajista confirmado') }
  else if (macd.trend === 'bullish') { score += 10; reasons.push('MACD positivo — momentum alcista activo') }
  else if (macd.trend === 'bearish') { score -= 10; reasons.push('MACD negativo — momentum bajista activo') }

  const distToSupport = supports[0] ? ((currentPrice - supports[0]) / currentPrice) * 100 : 999
  const distToResistance = resistances[0] ? ((resistances[0] - currentPrice) / currentPrice) * 100 : 999
  if (distToSupport < 0.5) { score += 10; reasons.push('Precio cerca de soporte clave') }
  if (distToResistance < 0.5) { score -= 10; reasons.push('Precio cerca de resistencia clave') }

  score = Math.max(-100, Math.min(100, score))

  const signal: AnalysisResult['signal'] =
    score >= 60 ? 'STRONG_LONG' :
    score >= 20 ? 'LONG' :
    score <= -60 ? 'STRONG_SHORT' :
    score <= -20 ? 'SHORT' : 'NEUTRAL'

  const trend: AnalysisResult['trend'] =
    currentPrice > ema21 && ema9 > ema21 ? 'ALCISTA' :
    currentPrice < ema21 && ema9 < ema21 ? 'BAJISTA' : 'LATERAL'

  const trendStrength = Math.abs(score)

  // ── Entry plan (always shown — direction inferred from trend or defaulted to LONG for neutral) ──
  const planDirection: 'LONG' | 'SHORT' =
    signal === 'STRONG_SHORT' || signal === 'SHORT' ? 'SHORT' : 'LONG'
  const entryPlan = buildEntryPlan(planDirection, currentPrice, supports, resistances, score)

  return {
    rsi, macd, ema9, ema21, ema50,
    currentPrice, priceVsEma9, priceVsEma21, ema9VsEma21,
    volumeTrend, support, resistance,
    supports, resistances,
    signal, signalScore: score,
    reasons: reasons.slice(0, 5),
    trend, trendStrength,
    entryPlan,
  }
}
