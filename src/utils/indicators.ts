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
  support: number
  resistance: number
  signal: 'STRONG_LONG' | 'LONG' | 'NEUTRAL' | 'SHORT' | 'STRONG_SHORT'
  signalScore: number // -100 to 100
  reasons: string[]
  trend: 'ALCISTA' | 'BAJISTA' | 'LATERAL'
  trendStrength: number // 0-100
}

export function analyzeMarket(klines: KlineData[]): AnalysisResult | null {
  if (klines.length < 55) return null

  const closes = klines.map((k) => k.close)
  const volumes = klines.map((k) => k.volume)
  const currentPrice = closes[closes.length - 1]

  const rsi = calcRSI(klines, 14)
  const ema9 = calcEMA(closes, 9)
  const ema21 = calcEMA(closes, 21)
  const ema50 = calcEMA(closes, 50)

  // Support & resistance (last 20 candles)
  const recent = klines.slice(-20)
  const support = Math.min(...recent.map((k) => k.low))
  const resistance = Math.max(...recent.map((k) => k.high))

  // Volume trend (last 5 vs previous 5)
  const recentVol = volumes.slice(-5).reduce((a, b) => a + b, 0)
  const prevVol = volumes.slice(-10, -5).reduce((a, b) => a + b, 0)
  const volumeTrend: AnalysisResult['volumeTrend'] =
    recentVol > prevVol * 1.1 ? 'increasing' : recentVol < prevVol * 0.9 ? 'decreasing' : 'neutral'

  const priceVsEma9: AnalysisResult['priceVsEma9'] = currentPrice >= ema9 ? 'above' : 'below'
  const priceVsEma21: AnalysisResult['priceVsEma21'] = currentPrice >= ema21 ? 'above' : 'below'
  const ema9VsEma21: AnalysisResult['ema9VsEma21'] = ema9 >= ema21 ? 'above' : 'below'

  // Score: +/- points per signal
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

  const distToSupport = ((currentPrice - support) / currentPrice) * 100
  const distToResistance = ((resistance - currentPrice) / currentPrice) * 100
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

  return {
    rsi, ema9, ema21, ema50,
    currentPrice, priceVsEma9, priceVsEma21, ema9VsEma21,
    volumeTrend, support, resistance,
    signal, signalScore: score,
    reasons: reasons.slice(0, 4),
    trend, trendStrength,
  }
}
