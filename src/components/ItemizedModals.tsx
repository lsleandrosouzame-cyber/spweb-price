import { useState, type FormEvent } from 'react'
import { X, Plus, Save } from 'lucide-react'
import { CurrencyInput } from './CurrencyInput'
import type { ProductCostRecord, ProductFeeRecord, ServiceCostRecord, ServiceFeeRecord } from '../types/database'

const inputLabel = 'mb-2 block text-xs font-medium text-paper'

// Product Cost Modal
interface ProductCostModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: { label: string; amount_cents: number; cost_type: 'acquisition' | 'additional' }) => Promise<void>
  editing?: ProductCostRecord | null
}

export function ProductCostModal({ isOpen, onClose, onSave, editing }: ProductCostModalProps) {
  const [label, setLabel] = useState(editing?.label ?? '')
  const [value, setValue] = useState(editing ? (Number(editing.amount_cents) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '')
  const [costType, setCostType] = useState<'acquisition' | 'additional'>(editing?.cost_type ?? 'acquisition')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const valueStr = value.replace(/\./g, '').replace(',', '.')
    const cents = Math.round(parseFloat(valueStr) * 100)
    if (!label.trim() || isNaN(cents) || cents < 0) {
      setError('Confira o nome e o valor informados.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave({ label: label.trim(), amount_cents: cents, cost_type: costType })
      onClose()
      setLabel('')
      setValue('')
      setCostType('acquisition')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="surface max-w-md w-full p-6 space-y-4">
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-bold">{editing ? 'Editar custo' : 'Novo custo'}</h3>
          <button type="button" onClick={onClose} className="text-muted hover:text-paper">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label>
            <span className={inputLabel}>Nome do custo</span>
            <input
              className="field"
              required
              maxLength={100}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex.: Matéria-prima principal"
            />
          </label>
          <label>
            <span className={inputLabel}>Valor (R$)</span>
            <CurrencyInput
              className="field"
              required
              value={value}
              onChange={setValue}
              placeholder="0,00"
            />
          </label>
          <label>
            <span className={inputLabel}>Tipo de custo</span>
            <select className="field" value={costType} onChange={(e) => setCostType(e.target.value as 'acquisition' | 'additional')}>
              <option value="acquisition">Custo de aquisição</option>
              <option value="additional">Custo adicional</option>
            </select>
          </label>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button className="btn-primary" disabled={saving}>
              {editing ? <Save size={15} /> : <Plus size={15} />}
              {editing ? 'Salvar' : 'Adicionar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Product Fee Modal
interface ProductFeeModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: { label: string; percent: number; fee_type: 'variable' | 'tax' }) => Promise<void>
  editing?: ProductFeeRecord | null
}

export function ProductFeeModal({ isOpen, onClose, onSave, editing }: ProductFeeModalProps) {
  const [label, setLabel] = useState(editing?.label ?? '')
  const [percent, setPercent] = useState(editing ? String(editing.percent) : '')
  const [feeType, setFeeType] = useState<'variable' | 'tax'>(editing?.fee_type ?? 'variable')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const percentValue = parseFloat(percent.replace(',', '.'))
    if (!label.trim() || isNaN(percentValue) || percentValue < 0 || percentValue > 100) {
      setError('Confira o nome e o percentual informados (0-100%).')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave({ label: label.trim(), percent: percentValue, fee_type: feeType })
      onClose()
      setLabel('')
      setPercent('')
      setFeeType('variable')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="surface max-w-md w-full p-6 space-y-4">
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-bold">{editing ? 'Editar taxa' : 'Nova taxa'}</h3>
          <button type="button" onClick={onClose} className="text-muted hover:text-paper">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label>
            <span className={inputLabel}>Nome da taxa</span>
            <input
              className="field"
              required
              maxLength={100}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex.: Cartão de crédito"
            />
          </label>
          <label>
            <span className={inputLabel}>Percentual (%)</span>
            <input
              className="field"
              type="number"
              required
              min="0"
              max="100"
              step="0.01"
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
              placeholder="Ex.: 3.5"
            />
          </label>
          <label>
            <span className={inputLabel}>Tipo de taxa</span>
            <select className="field" value={feeType} onChange={(e) => setFeeType(e.target.value as 'variable' | 'tax')}>
              <option value="variable">Taxa variável</option>
              <option value="tax">Imposto</option>
            </select>
          </label>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button className="btn-primary" disabled={saving}>
              {editing ? <Save size={15} /> : <Plus size={15} />}
              {editing ? 'Salvar' : 'Adicionar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Service Cost Modal (similar to product)
interface ServiceCostModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: { label: string; amount_cents: number; cost_type: 'material' | 'additional' }) => Promise<void>
  editing?: ServiceCostRecord | null
}

export function ServiceCostModal({ isOpen, onClose, onSave, editing }: ServiceCostModalProps) {
  const [label, setLabel] = useState(editing?.label ?? '')
  const [value, setValue] = useState(editing ? (Number(editing.amount_cents) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '')
  const [costType, setCostType] = useState<'material' | 'additional'>(editing?.cost_type ?? 'material')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const valueStr = value.replace(/\./g, '').replace(',', '.')
    const cents = Math.round(parseFloat(valueStr) * 100)
    if (!label.trim() || isNaN(cents) || cents < 0) {
      setError('Confira o nome e o valor informados.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave({ label: label.trim(), amount_cents: cents, cost_type: costType })
      onClose()
      setLabel('')
      setValue('')
      setCostType('material')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="surface max-w-md w-full p-6 space-y-4">
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-bold">{editing ? 'Editar custo' : 'Novo custo'}</h3>
          <button type="button" onClick={onClose} className="text-muted hover:text-paper">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label>
            <span className={inputLabel}>Nome do custo</span>
            <input
              className="field"
              required
              maxLength={100}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex.: Madeira MDF"
            />
          </label>
          <label>
            <span className={inputLabel}>Valor (R$)</span>
            <CurrencyInput
              className="field"
              required
              value={value}
              onChange={setValue}
              placeholder="0,00"
            />
          </label>
          <label>
            <span className={inputLabel}>Tipo de custo</span>
            <select className="field" value={costType} onChange={(e) => setCostType(e.target.value as 'material' | 'additional')}>
              <option value="material">Materiais e insumos</option>
              <option value="additional">Custo adicional</option>
            </select>
          </label>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button className="btn-primary" disabled={saving}>
              {editing ? <Save size={15} /> : <Plus size={15} />}
              {editing ? 'Salvar' : 'Adicionar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Service Fee Modal (same as product)
interface ServiceFeeModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: { label: string; percent: number; fee_type: 'variable' | 'tax' }) => Promise<void>
  editing?: ServiceFeeRecord | null
}

export function ServiceFeeModal({ isOpen, onClose, onSave, editing }: ServiceFeeModalProps) {
  const [label, setLabel] = useState(editing?.label ?? '')
  const [percent, setPercent] = useState(editing ? String(editing.percent) : '')
  const [feeType, setFeeType] = useState<'variable' | 'tax'>(editing?.fee_type ?? 'variable')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const percentValue = parseFloat(percent.replace(',', '.'))
    if (!label.trim() || isNaN(percentValue) || percentValue < 0 || percentValue > 100) {
      setError('Confira o nome e o percentual informados (0-100%).')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave({ label: label.trim(), percent: percentValue, fee_type: feeType })
      onClose()
      setLabel('')
      setPercent('')
      setFeeType('variable')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="surface max-w-md w-full p-6 space-y-4">
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-bold">{editing ? 'Editar taxa' : 'Nova taxa'}</h3>
          <button type="button" onClick={onClose} className="text-muted hover:text-paper">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label>
            <span className={inputLabel}>Nome da taxa</span>
            <input
              className="field"
              required
              maxLength={100}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex.: ISS"
            />
          </label>
          <label>
            <span className={inputLabel}>Percentual (%)</span>
            <input
              className="field"
              type="number"
              required
              min="0"
              max="100"
              step="0.01"
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
              placeholder="Ex.: 5"
            />
          </label>
          <label>
            <span className={inputLabel}>Tipo de taxa</span>
            <select className="field" value={feeType} onChange={(e) => setFeeType(e.target.value as 'variable' | 'tax')}>
              <option value="variable">Taxa variável</option>
              <option value="tax">Imposto</option>
            </select>
          </label>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button className="btn-primary" disabled={saving}>
              {editing ? <Save size={15} /> : <Plus size={15} />}
              {editing ? 'Salvar' : 'Adicionar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
