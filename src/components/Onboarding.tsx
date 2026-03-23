import { useState } from 'react'
import type { UserProfile, InvestmentPlan, RiskTolerance, TimeHorizon } from '../types'

const PROFILE_KEY = 'trade_user_profile'

export function loadProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    return raw ? (JSON.parse(raw) as UserProfile) : null
  } catch {
    return null
  }
}

export function saveProfile(profile: UserProfile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
}

export function clearProfile(): void {
  localStorage.removeItem(PROFILE_KEY)
}

export function generatePlan(profile: UserProfile): InvestmentPlan {
  const { capital, horizon, riskTolerance } = profile

  const config = {
    conservative: { leverage: 5,  riskPerTrade: 1,   maxTrades: 5,  dailyReturn: 1.5  },
    moderate:     { leverage: 15, riskPerTrade: 2,   maxTrades: 8,  dailyReturn: 3.5  },
    aggressive:   { leverage: 30, riskPerTrade: 2.5, maxTrades: 10, dailyReturn: 6.5  },
  }[riskTolerance]

  const intervalMap: Record<TimeHorizon, string> = {
    days: '5m', weeks: '15m', months: '1h',
  }
  const pairMap: Record<TimeHorizon, string> = {
    days: 'ETH/USDT', weeks: 'ETH/USDT', months: 'BTC/USDT',
  }

  const tradingDays = { days: 5, weeks: 22, months: 22 }[horizon]
  const monthlyProjection = capital * Math.pow(1 + config.dailyReturn / 100, tradingDays) - capital

  const notes: string[] = []
  if (riskTolerance === 'aggressive') {
    notes.push('Con 30x, un movimiento de 3.3% en contra liquida la posicion.')
    notes.push('Stop-loss obligatorio en CADA operacion sin excepcion.')
  }
  if (riskTolerance === 'conservative') {
    notes.push('Prioridad: no perder el capital base. El compounding hace el resto.')
  }
  if (capital < 300) {
    notes.push('Con menos de $300, mantener una sola cuenta es mas eficiente.')
  }
  notes.push(`Riesgo maximo por operacion: $${(capital * config.riskPerTrade / 100).toFixed(2)}`)

  return {
    recommendedLeverage: config.leverage,
    riskPerTrade: config.riskPerTrade,
    maxTradesPerDay: config.maxTrades,
    suggestedPair: pairMap[horizon],
    suggestedInterval: intervalMap[horizon],
    estimatedDailyReturn: config.dailyReturn,
    monthlyProjection,
    notes,
  }
}

interface Props {
  onComplete: (profile: UserProfile) => void
}

type Step = 0 | 1 | 2 | 3 | 4

const RISK_OPTIONS: { value: RiskTolerance; label: string; desc: string; color: string }[] = [
  { value: 'conservative', label: 'Conservador', desc: '5x · 1% riesgo/trade', color: 'bg-up' },
  { value: 'moderate',     label: 'Moderado',    desc: '15x · 2% riesgo/trade', color: 'bg-warn' },
  { value: 'aggressive',   label: 'Agresivo',    desc: '30x · 2.5% riesgo/trade', color: 'bg-down' },
]

const HORIZON_OPTIONS: { value: TimeHorizon; label: string; desc: string }[] = [
  { value: 'days',   label: 'Dias',    desc: 'Scalping · 5m' },
  { value: 'weeks',  label: 'Semanas', desc: 'Swing · 15m' },
  { value: 'months', label: 'Meses',   desc: 'Posicion · 1h' },
]

export function Onboarding({ onComplete }: Props) {
  const [step, setStep] = useState<Step>(0)
  const [capital, setCapital] = useState('')
  const [horizon, setHorizon] = useState<TimeHorizon | null>(null)
  const [expectedReturn, setExpectedReturn] = useState('')
  const [riskTolerance, setRiskTolerance] = useState<RiskTolerance | null>(null)

  const canNext = (): boolean => {
    if (step === 0) return parseFloat(capital) > 0
    if (step === 1) return horizon !== null
    if (step === 2) return true // optional
    if (step === 3) return riskTolerance !== null
    return false
  }

  const handleNext = () => {
    if (step < 3) { setStep((s) => (s + 1) as Step); return }
    const profile: UserProfile = {
      capital: parseFloat(capital),
      horizon: horizon!,
      expectedReturn: expectedReturn ? parseFloat(expectedReturn) : null,
      riskTolerance: riskTolerance!,
      createdAt: new Date().toISOString(),
    }
    saveProfile(profile)
    onComplete(profile)
  }

  const plan = step === 4 || (step === 3 && riskTolerance)
    ? generatePlan({
        capital: parseFloat(capital) || 0,
        horizon: horizon ?? 'weeks',
        expectedReturn: expectedReturn ? parseFloat(expectedReturn) : null,
        riskTolerance: riskTolerance ?? 'moderate',
        createdAt: '',
      })
    : null

  return (
    <div className="min-h-screen bg-surface-900 flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">

        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-white font-bold text-2xl tracking-tight">Trade Dashboard</h1>
          <p className="text-slate-400 text-sm">Configuremos tu perfil de inversion</p>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? 'w-6 bg-brand' : i < step ? 'w-3 bg-brand/50' : 'w-3 bg-surface-700'
              }`}
            />
          ))}
        </div>

        {/* Step 0 — Capital */}
        {step === 0 && (
          <div className="bg-surface-800 rounded-2xl p-5 space-y-4">
            <div>
              <h2 className="text-white font-bold text-base">Capital disponible</h2>
              <p className="text-slate-400 text-sm mt-1">Cuanto tienes listo para invertir en trading</p>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-mono">$</span>
              <input
                type="number"
                min="10"
                step="50"
                value={capital}
                onChange={(e) => setCapital(e.target.value)}
                placeholder="300"
                className="w-full bg-surface-700 border border-surface-600 rounded-xl pl-7 pr-3 py-3 text-white font-mono text-lg focus:outline-none focus:border-brand placeholder:text-slate-500"
                autoFocus
              />
            </div>
            {parseFloat(capital) > 0 && parseFloat(capital) < 100 && (
              <p className="text-warn text-xs">Con menos de $100 el margen de maniobra es muy limitado.</p>
            )}
          </div>
        )}

        {/* Step 1 — Horizon */}
        {step === 1 && (
          <div className="bg-surface-800 rounded-2xl p-5 space-y-4">
            <div>
              <h2 className="text-white font-bold text-base">Horizonte de tiempo</h2>
              <p className="text-slate-400 text-sm mt-1">Cuando esperas ver tus primeras ganancias</p>
            </div>
            <div className="space-y-2">
              {HORIZON_OPTIONS.map(({ value, label, desc }) => (
                <button
                  key={value}
                  onClick={() => setHorizon(value)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
                    horizon === value
                      ? 'border-brand bg-brand/10 text-white'
                      : 'border-surface-600 bg-surface-700 text-slate-300'
                  }`}
                >
                  <span className="font-bold text-sm">{label}</span>
                  <span className="text-xs text-slate-400">{desc}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2 — Expected return (optional) */}
        {step === 2 && (
          <div className="bg-surface-800 rounded-2xl p-5 space-y-4">
            <div>
              <h2 className="text-white font-bold text-base">Retorno esperado <span className="text-slate-500 font-normal text-sm">(opcional)</span></h2>
              <p className="text-slate-400 text-sm mt-1">Que % de ganancia mensual te gustaria lograr</p>
            </div>
            <div className="relative">
              <input
                type="number"
                min="1"
                max="500"
                step="5"
                value={expectedReturn}
                onChange={(e) => setExpectedReturn(e.target.value)}
                placeholder="50"
                className="w-full bg-surface-700 border border-surface-600 rounded-xl px-3 py-3 text-white font-mono text-lg focus:outline-none focus:border-brand placeholder:text-slate-500"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-mono">%</span>
            </div>
            <p className="text-slate-500 text-xs">Referencia: escenario conservador ~50%, optimista ~100-200% mensual con capital pequeno.</p>
          </div>
        )}

        {/* Step 3 — Risk tolerance */}
        {step === 3 && (
          <div className="bg-surface-800 rounded-2xl p-5 space-y-4">
            <div>
              <h2 className="text-white font-bold text-base">Tolerancia al riesgo</h2>
              <p className="text-slate-400 text-sm mt-1">Define tu estilo de operacion</p>
            </div>
            <div className="space-y-2">
              {RISK_OPTIONS.map(({ value, label, desc, color }) => (
                <button
                  key={value}
                  onClick={() => setRiskTolerance(value)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
                    riskTolerance === value
                      ? 'border-brand bg-brand/10 text-white'
                      : 'border-surface-600 bg-surface-700 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${color}`} />
                    <span className="font-bold text-sm">{label}</span>
                  </div>
                  <span className="text-xs text-slate-400">{desc}</span>
                </button>
              ))}
            </div>

            {/* Preview plan */}
            {plan && (
              <div className="mt-2 bg-surface-700 rounded-xl p-3 space-y-2 border border-surface-600">
                <p className="text-slate-300 text-xs font-bold uppercase tracking-wide">Tu plan estimado</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Apalancamiento', value: `${plan.recommendedLeverage}x` },
                    { label: 'Riesgo/trade', value: `${plan.riskPerTrade}% ($${(parseFloat(capital) * plan.riskPerTrade / 100).toFixed(0)})` },
                    { label: 'Max trades/dia', value: `${plan.maxTradesPerDay}` },
                    { label: 'Par recomendado', value: plan.suggestedPair },
                    { label: 'Retorno diario est.', value: `~${plan.estimatedDailyReturn}%`, color: 'text-up' },
                    { label: 'Proyeccion mensual', value: `+$${plan.monthlyProjection.toFixed(0)}`, color: 'text-up' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex flex-col gap-0.5">
                      <span className="text-slate-500 text-xs">{label}</span>
                      <span className={`font-mono text-xs font-bold ${color ?? 'text-white'}`}>{value}</span>
                    </div>
                  ))}
                </div>
                {plan.notes.map((note, i) => (
                  <p key={i} className="text-warn text-xs">{note}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Next / Finish button */}
        <button
          onClick={handleNext}
          disabled={!canNext()}
          className="w-full py-3.5 rounded-2xl font-bold text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-brand text-white hover:bg-indigo-500"
        >
          {step < 3 ? 'Continuar' : 'Ver mi dashboard'}
        </button>

        {step > 0 && (
          <button
            onClick={() => setStep((s) => (s - 1) as Step)}
            className="w-full text-slate-500 text-sm hover:text-slate-300 transition-colors"
          >
            Atras
          </button>
        )}
      </div>
    </div>
  )
}
