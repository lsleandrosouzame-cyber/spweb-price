import { useState, useEffect, type FormEvent } from 'react'
import { X, Plus, Save } from 'lucide-react'
import { CurrencyInput } from './CurrencyInput'
import type { ProductCostRecord, ProductFeeRecord, ServiceCostRecord, ServiceFeeRecord } from '../types/database'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const inputLabel = 'mb-2 block text-xs font-medium text-paper'

type InventoryItem = {
  id: string
  name: string
  unit_price_cents: number
  unit_measure: string
  is_fractional: boolean
}

// Product Cost Modal
interface ProductCostModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: { label: string; amount_cents: number; cost_type: 'acquisition' | 'additional' }) => Promise<void>
  editing?: ProductCostRecord | null
}

export function ProductCostModal({ isOpen, onClose, onSave, editing }: ProductCostModalProps) {
  const { currentCompany } = useAuth()
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [selectedItemId, setSelectedItemId] = useState<string>('')
  const [quantity, setQuantity] = useState<string>('1')
  const [label, setLabel] = useState(editing?.label ?? '')
  const [value, setValue] = useState(editing ? (Number(editing.amount_cents) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '')
  const [costType, setCostType] = useState<'acquisition' | 'additional'>(editing?.cost_type ?? 'acquisition')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Carregar itens do cadastro
  useEffect(() => {
    if (!isOpen || !currentCompany || !supabase) return
    
    async function loadInventory() {
      try {
        const { data, error } = await supabase!
          .from('inventory_items')
          .select('id, name, unit_price_cents, unit_measure, is_fractional')
          .eq('company_id', currentCompany!.id)
          .order('name', { ascending: true })
        
        if (error) throw error
        setInventoryItems(data || [])
      } catch (err) {
        console.warn('Não foi possível carregar itens do inventário:', err)
      }
    }
    
    void loadInventory()
  }, [isOpen, currentCompany])

  // Calcular valor automaticamente quando item ou quantidade mudar
  useEffect(() => {
    if (selectedItemId && selectedItemId !== 'outro') {
      const item = inventoryItems.find(i => i.id === selectedItemId)
      if (item) {
        const qty = parseFloat(quantity.replace(',', '.'))
        if (!isNaN(qty) && qty > 0) {
          const totalCents = Math.round(Number(item.unit_price_cents) * qty)
          setValue((totalCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }))
          setLabel(item.name)
        }
      }
    }
  }, [selectedItemId, quantity, inventoryItems])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    
    // Se "Outro" foi selecionado, validar nome customizado
    if (selectedItemId === 'outro' && !label.trim()) {
      setError('Digite o nome do custo.')
      return
    }
    
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
      // Reset
      setSelectedItemId('')
      setQuantity('1')
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

  const selectedItem = inventoryItems.find(i => i.id === selectedItemId)
  const isCustom = selectedItemId === 'outro'
  const isFromInventory = selectedItemId && selectedItemId !== 'outro'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="surface max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-bold">{editing ? 'Editar custo' : 'Novo custo'}</h3>
          <button type="button" onClick={onClose} className="text-muted hover:text-paper">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Dropdown: itens do cadastro + "Outro" */}
          <label>
            <span className={inputLabel}>Selecione o item</span>
            <select 
              className="field" 
              value={selectedItemId} 
              onChange={(e) => {
                setSelectedItemId(e.target.value)
                if (e.target.value === 'outro') {
                  setLabel('')
                  setValue('')
                  setQuantity('1')
                }
              }}
            >
              <option value="">-- Escolha um item --</option>
              {inventoryItems.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.unit_measure})
                </option>
              ))}
              <option value="outro">✏️ Outro (digitar manualmente)</option>
            </select>
          </label>

          {/* Se item do inventário, mostrar quantidade */}
          {isFromInventory && selectedItem && (
            <label>
              <span className={inputLabel}>
                Quantidade ({selectedItem.unit_measure})
                {selectedItem.is_fractional && <span className="text-muted text-[10px] ml-1">(fracionável)</span>}
              </span>
              <input
                className="field"
                type="number"
                min="0"
                step={selectedItem.is_fractional ? '0.01' : '1'}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="1"
              />
            </label>
          )}

          {/* Campo nome: somente se "Outro" */}
          {isCustom && (
            <label>
              <span className={inputLabel}>Nome do custo</span>
              <input
                className="field"
                required
                maxLength={100}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Ex.: Matéria-prima especial"
              />
            </label>
          )}

          {/* Se item do inventário, mostrar nome automaticamente (readonly) */}
          {isFromInventory && (
            <label>
              <span className={inputLabel}>Nome (automático)</span>
              <input
                className="field bg-gray-50 cursor-not-allowed"
                value={label}
                readOnly
                disabled
              />
            </label>
          )}

          {/* Valor: editável se "Outro", automático se item do cadastro */}
          <label>
            <span className={inputLabel}>
              Valor total (R$)
              {isFromInventory && <span className="text-muted text-[10px] ml-1">(calculado automaticamente)</span>}
            </span>
            <CurrencyInput
              className={`field ${isFromInventory ? 'bg-gray-50' : ''}`}
              required
              value={value}
              onChange={setValue}
              placeholder="0,00"
              disabled={Boolean(isFromInventory)}
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
            <button className="btn-primary" disabled={saving || !selectedItemId}>
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
  const { currentCompany } = useAuth()
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [selectedItemId, setSelectedItemId] = useState<string>('')
  const [quantity, setQuantity] = useState<string>('1')
  const [label, setLabel] = useState(editing?.label ?? '')
  const [value, setValue] = useState(editing ? (Number(editing.amount_cents) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '')
  const [costType, setCostType] = useState<'material' | 'additional'>(editing?.cost_type ?? 'material')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Carregar itens do cadastro
  useEffect(() => {
    if (!isOpen || !currentCompany || !supabase) return
    
    async function loadInventory() {
      try {
        const { data, error } = await supabase!
          .from('inventory_items')
          .select('id, name, unit_price_cents, unit_measure, is_fractional')
          .eq('company_id', currentCompany!.id)
          .order('name', { ascending: true })
        
        if (error) throw error
        setInventoryItems(data || [])
      } catch (err) {
        console.warn('Não foi possível carregar itens do inventário:', err)
      }
    }
    
    void loadInventory()
  }, [isOpen, currentCompany])

  // Calcular valor automaticamente quando item ou quantidade mudar
  useEffect(() => {
    if (selectedItemId && selectedItemId !== 'outro') {
      const item = inventoryItems.find(i => i.id === selectedItemId)
      if (item) {
        const qty = parseFloat(quantity.replace(',', '.'))
        if (!isNaN(qty) && qty > 0) {
          const totalCents = Math.round(Number(item.unit_price_cents) * qty)
          setValue((totalCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }))
          setLabel(item.name)
        }
      }
    }
  }, [selectedItemId, quantity, inventoryItems])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    
    // Se "Outro" foi selecionado, validar nome customizado
    if (selectedItemId === 'outro' && !label.trim()) {
      setError('Digite o nome do custo.')
      return
    }
    
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
      // Reset
      setSelectedItemId('')
      setQuantity('1')
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

  const selectedItem = inventoryItems.find(i => i.id === selectedItemId)
  const isCustom = selectedItemId === 'outro'
  const isFromInventory = selectedItemId && selectedItemId !== 'outro'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="surface max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-bold">{editing ? 'Editar custo' : 'Novo custo'}</h3>
          <button type="button" onClick={onClose} className="text-muted hover:text-paper">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Dropdown: itens do cadastro + "Outro" */}
          <label>
            <span className={inputLabel}>Selecione o item</span>
            <select 
              className="field" 
              value={selectedItemId} 
              onChange={(e) => {
                setSelectedItemId(e.target.value)
                if (e.target.value === 'outro') {
                  setLabel('')
                  setValue('')
                  setQuantity('1')
                }
              }}
            >
              <option value="">-- Escolha um item --</option>
              {inventoryItems.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.unit_measure})
                </option>
              ))}
              <option value="outro">✏️ Outro (digitar manualmente)</option>
            </select>
          </label>

          {/* Se item do inventário, mostrar quantidade */}
          {isFromInventory && selectedItem && (
            <label>
              <span className={inputLabel}>
                Quantidade ({selectedItem.unit_measure})
                {selectedItem.is_fractional && <span className="text-muted text-[10px] ml-1">(fracionável)</span>}
              </span>
              <input
                className="field"
                type="number"
                min="0"
                step={selectedItem.is_fractional ? '0.01' : '1'}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="1"
              />
            </label>
          )}

          {/* Campo nome: somente se "Outro" */}
          {isCustom && (
            <label>
              <span className={inputLabel}>Nome do custo</span>
              <input
                className="field"
                required
                maxLength={100}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Ex.: Material específico"
              />
            </label>
          )}

          {/* Se item do inventário, mostrar nome automaticamente (readonly) */}
          {isFromInventory && (
            <label>
              <span className={inputLabel}>Nome (automático)</span>
              <input
                className="field bg-gray-50 cursor-not-allowed"
                value={label}
                readOnly
                disabled
              />
            </label>
          )}

          {/* Valor: editável se "Outro", automático se item do cadastro */}
          <label>
            <span className={inputLabel}>
              Valor total (R$)
              {isFromInventory && <span className="text-muted text-[10px] ml-1">(calculado automaticamente)</span>}
            </span>
            <CurrencyInput
              className={`field ${isFromInventory ? 'bg-gray-50' : ''}`}
              required
              value={value}
              onChange={setValue}
              placeholder="0,00"
              disabled={Boolean(isFromInventory)}
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
            <button className="btn-primary" disabled={saving || !selectedItemId}>
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
