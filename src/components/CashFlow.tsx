import { useState } from 'react'
import type { CashFlowEntry, CashFlowProfile, UserProfile, InvestmentPlan } from '../types'
import { generatePlan } from './Onboarding'

const CF_KEY = 'trade_cashflow_profile'

function loadCF(): CashFlowProfile {
  try {
    const raw = localStorage.getItem(CF_KEY)
    return raw
      ? (JSON.parse(raw) as CashFlowProfile)
      : { incomes: [], expenses: [] }
  } catch {
    return { incomes: [], expenses: [] }
  }
}

function saveCF(cf: CashFlowProfile) {
  localStorage.setItem(CF_KEY, JSON.stringify(cf))
}

function uid() {
  return Math.random().toString(36).slice(2, 9)
}

function total(entries: CashFlowEntry[]) {
  return entries.reduce((s, e) => s + e.amount, 0)
}

const FIELD = 'bg-surface-700 border border-surface-600 rounded-xl px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-brand placeholder:text-slate-500'

interface EntryRowProps {
  entry: CashFlowEntry
  onDelete: (id: string) => void
  onUpdate: (id: string, field: 'label' | 'amount', value: string) => void
}

function EntryRow({ entry, onDelete, onUpdate }: EntryRowProps) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={entry.label}
        onChange={(e) => onUpdate(entry.id, 'label', e.target.value)}
        placeholder="Descripcion"
        className={`${FIELD} flex-1 min-w-0`}
      />
      <div className="relative w-28 shrink-0">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
        <input
          type="number"
          min="0"
          step="10"
          value={entry.amount || ''}
          onChange={(e) => onUpdate(entry.id, 'amount', e.target.value)}
          placeholder="0"
          className={`${FIELD} w-full pl-5`}
        />
      </div>
      <button
        onClick={() => onDelete(entry.id)}
        className="text-slate-500 hover:text-down text-sm transition-colors shrink-0"
        aria-label="Eliminar"
      >
        ✕
      </button>
    </div>
  )
}

interface Props {
  profile: UserProfile
}

export function CashFlow({ profile }: Props) {
  const [cf, setCf] = useState<CashFlowProfile>(loadCF)
  const [oppCapital, setOppCapital] = useState('')
  const [oppReturn, setOppReturn] = useState('')
  const [oppMonths, setOppMonths] = useState('1')

  const plan: InvestmentPlan = generatePlan(profile)

  const updateAndSave = (next: CashFlowProfile) => {
    setCf(next)
    saveCF(next)
  }

  const addEntry = (section: 'incomes' | 'expenses') => {
    updateAndSave({
      ...cf,
      [section]: [...cf[section], { id: uid(), label: '', amount: 0 }],
    })
  }

  const deleteEntry = (section: 'incomes' | 'expenses', id: string) => {
    updateAndSave({ ...cf, [section]: cf[section].filter((e) => e.id !== id) })
  }

  const updateEntry = (
    section: 'incomes' | 'expenses',
    id: string,
    field: 'label' | 'amount',
    value: string
  ) => {
    updateAndSave({
      ...cf,
      [section]: cf[section].map((e) =>
        e.id === id ? { ...e, [field]: field === 'amount' ? parseFloat(value) || 0 : value } : e
      ),
    })
  }

  const totalIncome = total(cf.incomes)
  const totalExpenses = total(cf.expenses)
  const freeCashFlow = totalIncome - totalExpenses

  // Opportunity evaluator
  const oppCap = parseFloat(oppCapital) || 0
  const oppRet = parseFloat(oppReturn) || 0
  const oppMo = parseInt(oppMonths) || 1
  const monthlyGain = oppCap * (oppRet / 100)
  const viable = freeCashFlow > 0 && oppCap <= freeCashFlow * oppMo
  const leverageable = freeCashFlow > 0 && oppCap > freeCashFlow && oppCap <= freeCashFlow * oppMo * 3

  return (
    <div className="space-y-4">

      {/* Profile summary */}
      <div className="bg-surface-800 rounded-2xl p-4 space-y-3">
        <h2 className="text-white font-bold text-base">Mi Perfil de Inversion</h2>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Capital trading', value: `$${profile.capital.toLocaleString()}` },
            { label: 'Horizonte', value: { days: 'Dias', weeks: 'Semanas', months: 'Meses' }[profile.horizon] },
            { label: 'Apalancamiento', value: `${plan.recommendedLeverage}x` },
            { label: 'Par recomendado', value: plan.suggestedPair },
            { label: 'Proyeccion mensual', value: `+$${plan.monthlyProjection.toFixed(0)}`, color: 'text-up' },
            { label: 'Riesgo/trade max', value: `$${(profile.capital * plan.riskPerTrade / 100).toFixed(2)}`, color: 'text-warn' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-surface-700 rounded-xl px-3 py-2">
              <p className="text-slate-400 text-xs">{label}</p>
              <p className={`font-mono text-sm font-bold ${color ?? 'text-white'}`}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Cash Flow statement */}
      <div className="bg-surface-800 rounded-2xl p-4 space-y-4">
        <h2 className="text-white font-bold text-base">Estado de Flujo de Caja</h2>
        <p className="text-slate-400 text-xs -mt-2">Basado en Cash Flow de Kiyosaki — registra tu situacion real</p>

        {/* Incomes */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-up text-xs font-bold uppercase tracking-wide">Ingresos / mes</p>
            <p className="text-up font-mono text-sm font-bold">${totalIncome.toLocaleString()}</p>
          </div>
          {cf.incomes.map((e) => (
            <EntryRow
              key={e.id}
              entry={e}
              onDelete={(id) => deleteEntry('incomes', id)}
              onUpdate={(id, f, v) => updateEntry('incomes', id, f, v)}
            />
          ))}
          <button
            onClick={() => addEntry('incomes')}
            className="text-xs text-up hover:text-green-300 transition-colors"
          >
            + Agregar ingreso
          </button>
        </div>

        <div className="border-t border-surface-700" />

        {/* Expenses */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-down text-xs font-bold uppercase tracking-wide">Gastos / mes</p>
            <p className="text-down font-mono text-sm font-bold">${totalExpenses.toLocaleString()}</p>
          </div>
          {cf.expenses.map((e) => (
            <EntryRow
              key={e.id}
              entry={e}
              onDelete={(id) => deleteEntry('expenses', id)}
              onUpdate={(id, f, v) => updateEntry('expenses', id, f, v)}
            />
          ))}
          <button
            onClick={() => addEntry('expenses')}
            className="text-xs text-down hover:text-red-300 transition-colors"
          >
            + Agregar gasto
          </button>
        </div>

        <div className="border-t border-surface-700" />

        {/* Free cash flow */}
        <div className={`rounded-xl px-4 py-3 flex justify-between items-center ${
          freeCashFlow >= 0 ? 'bg-up/10 border border-up/30' : 'bg-down/10 border border-down/30'
        }`}>
          <span className="text-white font-bold text-sm">Flujo libre mensual</span>
          <span className={`font-mono font-bold text-base ${freeCashFlow >= 0 ? 'text-up' : 'text-down'}`}>
            {freeCashFlow >= 0 ? '+' : ''}${freeCashFlow.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Opportunity evaluator */}
      <div className="bg-surface-800 rounded-2xl p-4 space-y-4">
        <h2 className="text-white font-bold text-base">Evaluador de Oportunidad</h2>
        <p className="text-slate-400 text-xs -mt-2">Como en Cash Flow: ¿puedes tomar esta inversion segun tu flujo?</p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-slate-300 text-xs mb-1 block">Capital requerido ($)</label>
            <input
              type="number"
              min="0"
              step="50"
              value={oppCapital}
              onChange={(e) => setOppCapital(e.target.value)}
              placeholder="500"
              className={FIELD + ' w-full'}
            />
          </div>
          <div>
            <label className="text-slate-300 text-xs mb-1 block">Retorno esperado (%/mes)</label>
            <input
              type="number"
              min="0"
              step="5"
              value={oppReturn}
              onChange={(e) => setOppReturn(e.target.value)}
              placeholder="50"
              className={FIELD + ' w-full'}
            />
          </div>
          <div className="col-span-2">
            <label className="text-slate-300 text-xs mb-1 block">Meses para recuperar capital</label>
            <input
              type="number"
              min="1"
              step="1"
              value={oppMonths}
              onChange={(e) => setOppMonths(e.target.value)}
              className={FIELD + ' w-full'}
            />
          </div>
        </div>

        {oppCap > 0 && (
          <div className="space-y-2 pt-1">
            <div className="flex justify-between items-center bg-surface-700 rounded-xl px-3 py-2">
              <span className="text-slate-300 text-xs">Ganancia mensual estimada</span>
              <span className="font-mono text-sm text-up font-bold">+${monthlyGain.toFixed(0)}/mes</span>
            </div>
            <div className="flex justify-between items-center bg-surface-700 rounded-xl px-3 py-2">
              <span className="text-slate-300 text-xs">Recuperacion en {oppMonths} mes(es)</span>
              <span className="font-mono text-sm text-white font-bold">
                ${(monthlyGain * parseInt(oppMonths)).toFixed(0)} ganado
              </span>
            </div>
            <div className={`rounded-xl px-4 py-3 border ${
              viable
                ? 'bg-up/10 border-up/30'
                : leverageable
                ? 'bg-warn/10 border-warn/30'
                : 'bg-down/10 border-down/30'
            }`}>
              <p className={`font-bold text-sm ${viable ? 'text-up' : leverageable ? 'text-warn' : 'text-down'}`}>
                {viable
                  ? 'Viable — tu flujo lo soporta'
                  : leverageable
                  ? 'Posible con apalancamiento — evalua bien el riesgo'
                  : 'No recomendado — el capital supera tu flujo disponible'}
              </p>
              <p className="text-slate-400 text-xs mt-1">
                {viable
                  ? `Tu flujo libre cubre el capital en ${oppMonths} mes(es) sin comprometer gastos.`
                  : leverageable
                  ? `Necesitas acumular ${oppMo} meses de flujo libre para cubrir el capital.`
                  : `Tu flujo libre mensual de $${freeCashFlow} no cubre $${oppCap} en el tiempo dado.`}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
