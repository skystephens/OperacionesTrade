export interface VelaData {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface IndicadoresCalculados {
  rsi: number
  ema9: number
  ema21: number
  volumenPromedio: number
  volumenActual: number
  volumenRelativo: number
  tendencia: 'ALCISTA' | 'BAJISTA' | 'LATERAL'
  precio: number
}

export interface PatronDetectado {
  nombre: string
  tipo: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
  descripcion: string
}

export interface AnalisisTimeframe {
  intervalo: string
  indicadores: IndicadoresCalculados
  patrones: PatronDetectado[]
  velas: VelaData[]
}

export interface ResultadoIA {
  señal: 'LONG' | 'SHORT' | 'ESPERAR'
  confianza: number
  razon_principal: string
  patron_detectado: string
  entrada_sugerida: number
  stop_loss: number
  take_profit: number
  advertencias: string[]
  checklist: {
    tendencia_alineada: boolean
    volumen_confirmado: boolean
    rsi_favorable: boolean
    patron_claro: boolean
  }
}
