import { useState, useMemo } from 'react'
import type { RiskCalcInput, RiskCalcResult } from '../types'

function calcRisk(input: RiskCalcInput): RiskCalcResult {
  const { capital, riskPercent, leverage, entryPrice, stopLossPercent, direction } = input
  const maxLoss = capital * (riskPercent / 100)
  const stopDistPercent = stopLossPercent / 100
  const positionSize = maxLoss / (entryPrice * stopDistPercent)
  const marginRequired = (positionSize * entryPrice) / leverage

  const stopLossPrice =
    direction === 'LONG'
      ? entryPrice * (1 - stopDistPercent)
      : entryPrice * (1 + stopDistPercent)

  const tpMultiplier = 2 // 1:2 R/R
  const takeProfitPrice =
    direction === 'LONG'
      ? entryPrice * (1 + stopDistPercent * tpMultiplier)
      : entryPrice * (1 - stopDistPercent * tpMultiplier)

  // Simplified liquidation (no funding/fees)
  const liquidationPrice =
    direction === 'LONG'
      ? entryPrice * (1 - 1 / leverage)
      : entryPrice * (1 + 1 / leverage)

  return {
    positionSize,
    marginRequired,
    maxLoss,
    stopLossPrice,
    takeProfitPrice,
    liquidationPrice,
    riskRewardRatio: tpMultiplier,
  }
}

interface Props {
  currentPrice: number | null
}

const FIELD_CLASS =
  'w-full bg-surface-700 border border-surface-600 rounded-xl px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-brand placeholder:text-slate-500'

export function RiskCalculator({ currentPrice }: Props) {
  const [form, setForm] = useState<RiskCalcInput>({
    capital: 200,
    riskPercent: 2,
    leverage: 15,
    entryPrice: currentPrice ?? 2108.28,
    stopLossPercent: 2,
    direction: 'LONG',
  })

  // Sync entry price when currentPrice arrives
  const entryPrice = form.entryPrice || currentPrice || 2108.28

  const result = useMemo(
    () => calcRisk({ ...form, entryPrice }),
    [form, entryPrice]
  )

  const set = (key: keyof RiskCalcInput, value: number | string) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  return (
    <div className="bg-surface-800 rounded-2xl p-4 space-y-4">
      <h2 className="text-white font-bold text-base">Calculadora de Riesgo</h2>

      {/* Direction toggle */}
      <div className="grid grid-cols-2 gap-2">
        {(['LONG', 'SHORT'] as const).map((d) => (
          <button
            key={d}
            onClick={() => set('direction', d)}
            className={`py-2 rounded-xl font-bold text-sm transition-colors ${
              form.direction === d
                ? d === 'LONG'
                  ? 'bg-up text-white'
                  : 'bg-down text-white'
                : 'bg-surface-700 text-surface-600'
            }`}
          >
            {d === 'LONG' ? '▲ LONG' : '▼ SHORT'}
          </button>
        ))}
      </div>

      {/* Inputs grid */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Capital ($)', key: 'capital' as const, step: 50 },
          { label: 'Riesgo (%)', key: 'riskPercent' as const, step: 0.5 },
          { label: 'Apalancamiento (x)', key: 'leverage' as const, step: 1 },
          { label: 'Precio entrada ($)', key: 'entryPrice' as const, step: 1 },
          { label: 'Stop-Loss (%)', key: 'stopLossPercent' as const, step: 0.1 },
        ].map(({ label, key, step }) => (
          <div key={key}>
            <label className="text-slate-300 text-xs mb-1 block">{label}</label>
            <input
              type="number"
              step={step}
              value={key === 'entryPrice' ? entryPrice : form[key]}
              onChange={(e) => set(key, parseFloat(e.target.value) || 0)}
              className={FIELD_CLASS}
            />
          </div>
        ))}
      </div>

      {/* Liquidation warning */}
      {form.leverage >= 25 && form.stopLossPercent >= 2 && (
        <div className="bg-down/10 border border-down/30 rounded-xl px-3 py-2">
          <p className="text-down text-xs font-bold">Advertencia: apalancamiento alto</p>
          <p className="text-slate-300 text-xs mt-0.5">
            Con {form.leverage}x, liquidan a {(100 / form.leverage).toFixed(1)}% de movimiento adverso.
            Tu SL de {form.stopLossPercent}% esta muy cerca — un spike puede liquidarte antes de que ejecute.
            Considera bajar a 15x-20x con este stop-loss.
          </p>
        </div>
      )}

      {/* Results */}
      <div className="space-y-2 pt-2 border-t border-surface-700">
        {[
          { label: 'Perdida maxima', value: `$${result.maxLoss.toFixed(2)}`, color: 'text-down' },
          { label: 'Margen requerido', value: `$${result.marginRequired.toFixed(2)}`, color: 'text-warn' },
          { label: 'Tamano posicion', value: `${result.positionSize.toFixed(4)} ETH`, color: 'text-white' },
          { label: 'Stop-Loss precio', value: `$${result.stopLossPrice.toFixed(2)}`, color: 'text-down' },
          { label: 'Take-Profit (1:2)', value: `$${result.takeProfitPrice.toFixed(2)}`, color: 'text-up' },
          { label: 'Precio liquidacion', value: `$${result.liquidationPrice.toFixed(2)}`, color: 'text-down font-bold' },
        ].map(({ label, value, color }) => (
          <div key={label} className="flex justify-between items-center bg-surface-700 rounded-xl px-3 py-2">
            <span className="text-slate-300 text-xs font-semibold">{label}</span>
            <span className={`font-mono text-sm ${color}`}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
