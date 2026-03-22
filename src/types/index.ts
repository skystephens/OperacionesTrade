export interface TickerData {
  symbol: string
  price: number
  priceChange: number
  priceChangePercent: number
  high: number
  low: number
  volume: number
  quoteVolume: number
}

export interface KlineData {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  isClosed: boolean
}

export interface TradeEntry {
  id: string
  date: string
  pair: string
  direction: 'LONG' | 'SHORT'
  entryPrice: number
  exitPrice: number | null
  size: number
  leverage: number
  pnl: number | null
  status: 'OPEN' | 'CLOSED' | 'LIQUIDATED'
  notes: string
}

export interface RiskCalcInput {
  capital: number
  riskPercent: number
  leverage: number
  entryPrice: number
  stopLossPercent: number
  direction: 'LONG' | 'SHORT'
}

export interface RiskCalcResult {
  positionSize: number
  marginRequired: number
  maxLoss: number
  stopLossPrice: number
  takeProfitPrice: number
  liquidationPrice: number
  riskRewardRatio: number
}
