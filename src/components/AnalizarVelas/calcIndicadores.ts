import { calcRSI, calcEMA } from '../../utils/indicators'
import type { VelaData, IndicadoresCalculados } from './types'
import type { KlineData } from '../../types'

function toKline(v: VelaData): KlineData {
  return { ...v, isClosed: true }
}

export async function fetchVelas(symbol: string, interval: string, limit = 50): Promise<VelaData[]> {
  const url = `https://data-api.binance.vision/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Binance ${interval}: HTTP ${res.status}`)
  const data: unknown[][] = await res.json()
  return data.map((k) => ({
    time: k[0] as number,
    open: parseFloat(k[1] as string),
    high: parseFloat(k[2] as string),
    low: parseFloat(k[3] as string),
    close: parseFloat(k[4] as string),
    volume: parseFloat(k[5] as string),
  }))
}

export function calcularIndicadores(velas: VelaData[]): IndicadoresCalculados {
  const klines = velas.map(toKline)
  const closes = velas.map((v) => v.close)
  const volumes = velas.map((v) => v.volume)

  const rsi = calcRSI(klines, 14)
  const ema9 = calcEMA(closes, 9)
  const ema21 = calcEMA(closes, 21)

  const volumenActual = volumes[volumes.length - 1]
  const volumenPromedio = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20
  const volumenRelativo = volumenActual / volumenPromedio

  const precio = closes[closes.length - 1]

  const tendencia: IndicadoresCalculados['tendencia'] =
    precio > ema21 && ema9 > ema21 ? 'ALCISTA' :
    precio < ema21 && ema9 < ema21 ? 'BAJISTA' : 'LATERAL'

  return { rsi, ema9, ema21, volumenActual, volumenPromedio, volumenRelativo, tendencia, precio }
}
