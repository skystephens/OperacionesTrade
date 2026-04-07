import type { VelaData, PatronDetectado } from './types'

function cuerpo(v: VelaData) { return Math.abs(v.close - v.open) }
function rango(v: VelaData)  { return v.high - v.low || 0.0001 }
function sombraInf(v: VelaData) { return Math.min(v.open, v.close) - v.low }
function sombraSup(v: VelaData) { return v.high - Math.max(v.open, v.close) }
function esBullish(v: VelaData) { return v.close > v.open }
function esBearish(v: VelaData) { return v.close < v.open }

export function detectarPatrones(velas: VelaData[]): PatronDetectado[] {
  if (velas.length < 3) return []

  const patrones: PatronDetectado[] = []
  const n = velas.length

  const v0 = velas[n - 1] // vela actual
  const v1 = velas[n - 2] // vela anterior
  const v2 = velas[n - 3] // 2 velas atrás

  // ── Doji ──────────────────────────────────────────────────────────────────
  if (cuerpo(v0) / rango(v0) < 0.1) {
    patrones.push({
      nombre: 'Doji',
      tipo: 'NEUTRAL',
      descripcion: 'Indecisión del mercado — apertura y cierre casi iguales. Señal de posible reversión.',
    })
  }

  // ── Hammer / Hanging Man ──────────────────────────────────────────────────
  const hammerShape =
    sombraInf(v0) >= 2 * cuerpo(v0) &&
    sombraSup(v0) <= 0.5 * cuerpo(v0) &&
    cuerpo(v0) > 0

  if (hammerShape) {
    const enTendenciaBajista = v1.close < v2.close
    if (enTendenciaBajista) {
      patrones.push({
        nombre: 'Hammer',
        tipo: 'BULLISH',
        descripcion: 'Martillo en tendencia bajista — los vendedores fueron rechazados. Posible reversión al alza.',
      })
    } else {
      patrones.push({
        nombre: 'Hanging Man',
        tipo: 'BEARISH',
        descripcion: 'Hombre colgado en tendencia alcista — advertencia de posible corrección bajista.',
      })
    }
  }

  // ── Shooting Star / Inverted Hammer ──────────────────────────────────────
  const shootingShape =
    sombraSup(v0) >= 2 * cuerpo(v0) &&
    sombraInf(v0) <= 0.5 * cuerpo(v0) &&
    cuerpo(v0) > 0

  if (shootingShape) {
    const enTendenciaAlcista = v1.close > v2.close
    if (enTendenciaAlcista) {
      patrones.push({
        nombre: 'Shooting Star',
        tipo: 'BEARISH',
        descripcion: 'Estrella fugaz — los compradores fallaron en mantener el alto. Posible techo.',
      })
    } else {
      patrones.push({
        nombre: 'Inverted Hammer',
        tipo: 'BULLISH',
        descripcion: 'Martillo invertido en tendencia bajista — posible reversión al alza pendiente de confirmación.',
      })
    }
  }

  // ── Bullish Engulfing ────────────────────────────────────────────────────
  if (
    esBearish(v1) &&
    esBullish(v0) &&
    v0.open <= v1.close &&
    v0.close >= v1.open
  ) {
    patrones.push({
      nombre: 'Bullish Engulfing',
      tipo: 'BULLISH',
      descripcion: 'Envolvente alcista — vela verde cubre completamente la roja anterior. Señal fuerte de compra.',
    })
  }

  // ── Bearish Engulfing ────────────────────────────────────────────────────
  if (
    esBullish(v1) &&
    esBearish(v0) &&
    v0.open >= v1.close &&
    v0.close <= v1.open
  ) {
    patrones.push({
      nombre: 'Bearish Engulfing',
      tipo: 'BEARISH',
      descripcion: 'Envolvente bajista — vela roja cubre completamente la verde anterior. Señal fuerte de venta.',
    })
  }

  // ── Morning Star ─────────────────────────────────────────────────────────
  if (
    esBearish(v2) && cuerpo(v2) > rango(v2) * 0.5 &&
    cuerpo(v1) < rango(v1) * 0.3 &&
    esBullish(v0) && v0.close > (v2.open + v2.close) / 2
  ) {
    patrones.push({
      nombre: 'Morning Star',
      tipo: 'BULLISH',
      descripcion: 'Estrella de la mañana — 3 velas de reversión bajista a alcista. Señal de compra muy fuerte.',
    })
  }

  // ── Evening Star ─────────────────────────────────────────────────────────
  if (
    esBullish(v2) && cuerpo(v2) > rango(v2) * 0.5 &&
    cuerpo(v1) < rango(v1) * 0.3 &&
    esBearish(v0) && v0.close < (v2.open + v2.close) / 2
  ) {
    patrones.push({
      nombre: 'Evening Star',
      tipo: 'BEARISH',
      descripcion: 'Estrella de la tarde — 3 velas de reversión alcista a bajista. Señal de venta muy fuerte.',
    })
  }

  return patrones
}
