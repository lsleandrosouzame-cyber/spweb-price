import { Pencil, Trash2, Plus } from 'lucide-react'
import { formatBRLFromCents, formatPercent } from '../lib/money'
import type { ProductCostRecord, ProductFeeRecord, ServiceCostRecord, ServiceFeeRecord } from '../types/database'

// Product Costs List
interface ProductCostsListProps {
  costs: ProductCostRecord[]
  onEdit: (cost: ProductCostRecord) => void
  onDelete: (id: string) => void
  onAdd: () => void
}

export function ProductCostsList({ costs, onEdit, onDelete, onAdd }: ProductCostsListProps) {
  const totalCents = costs.reduce((sum, c) => sum + Number(c.amount_cents), 0)

  return (
    <div className="surface p-5 space-y-3">
      <div className="flex items-center justify-between border-b border-line pb-3">
        <div>
          <p className="text-sm font-semibold text-paper">Custos</p>
          <p className="text-xs text-muted mt-0.5">Total: {formatBRLFromCents(totalCents)}</p>
        </div>
        <button
          type="button"
          className="btn-secondary !py-1.5 !px-3 text-xs flex items-center gap-1"
          onClick={onAdd}
        >
          <Plus size={12} />
          Adicionar
        </button>
      </div>

      {costs.length === 0 ? (
        <p className="text-center text-sm text-muted py-4">Nenhum custo cadastrado</p>
      ) : (
        <div className="space-y-2">
          {costs.map((cost) => (
            <div
              key={cost.id}
              className="flex items-center justify-between rounded-lg border border-line bg-panel px-3 py-2.5 hover:border-teal-border transition-colors group"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className={`size-2 rounded-full shrink-0 ${cost.cost_type === 'acquisition' ? 'bg-blue-500' : 'bg-purple-500'}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-paper truncate">{cost.label}</p>
                  <p className="text-xs text-muted">{cost.cost_type === 'acquisition' ? 'Aquisição' : 'Adicional'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono text-base font-bold text-paper mr-2">
                  {formatBRLFromCents(cost.amount_cents)}
                </span>
                <button
                  type="button"
                  aria-label={`Editar ${cost.label}`}
                  className="rounded p-1.5 text-muted hover:text-paper transition-colors opacity-0 group-hover:opacity-100"
                  onClick={() => onEdit(cost)}
                >
                  <Pencil size={13} />
                </button>
                <button
                  type="button"
                  aria-label={`Excluir ${cost.label}`}
                  className="rounded p-1.5 text-muted hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                  onClick={() => onDelete(cost.id)}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Product Fees List
interface ProductFeesListProps {
  fees: ProductFeeRecord[]
  onEdit: (fee: ProductFeeRecord) => void
  onDelete: (id: string) => void
  onAdd: () => void
}

export function ProductFeesList({ fees, onEdit, onDelete, onAdd }: ProductFeesListProps) {
  const totalPercent = fees.reduce((sum, f) => sum + Number(f.percent), 0)

  return (
    <div className="surface p-5 space-y-3">
      <div className="flex items-center justify-between border-b border-line pb-3">
        <div>
          <p className="text-sm font-semibold text-paper">Taxas e encargos</p>
          <p className="text-xs text-muted mt-0.5">Total: {formatPercent(totalPercent)}</p>
        </div>
        <button
          type="button"
          className="btn-secondary !py-1.5 !px-3 text-xs flex items-center gap-1"
          onClick={onAdd}
        >
          <Plus size={12} />
          Adicionar
        </button>
      </div>

      {fees.length === 0 ? (
        <p className="text-center text-sm text-muted py-4">Nenhuma taxa cadastrada</p>
      ) : (
        <div className="space-y-2">
          {fees.map((fee) => (
            <div
              key={fee.id}
              className="flex items-center justify-between rounded-lg border border-line bg-panel px-3 py-2.5 hover:border-teal-border transition-colors group"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className={`size-2 rounded-full shrink-0 ${fee.fee_type === 'variable' ? 'bg-orange-500' : 'bg-red-500'}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-paper truncate">{fee.label}</p>
                  <p className="text-xs text-muted">{fee.fee_type === 'variable' ? 'Taxas variáveis' : 'Impostos'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`font-mono text-base font-bold mr-2 ${fee.fee_type === 'variable' ? 'text-orange-500' : 'text-red-500'}`}>
                  {formatPercent(fee.percent)}
                </span>
                <button
                  type="button"
                  aria-label={`Editar ${fee.label}`}
                  className="rounded p-1.5 text-muted hover:text-paper transition-colors opacity-0 group-hover:opacity-100"
                  onClick={() => onEdit(fee)}
                >
                  <Pencil size={13} />
                </button>
                <button
                  type="button"
                  aria-label={`Excluir ${fee.label}`}
                  className="rounded p-1.5 text-muted hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                  onClick={() => onDelete(fee.id)}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Service Costs List
interface ServiceCostsListProps {
  costs: ServiceCostRecord[]
  onEdit: (cost: ServiceCostRecord) => void
  onDelete: (id: string) => void
  onAdd: () => void
}

export function ServiceCostsList({ costs, onEdit, onDelete, onAdd }: ServiceCostsListProps) {
  const totalCents = costs.reduce((sum, c) => sum + Number(c.amount_cents), 0)

  return (
    <div className="surface p-5 space-y-3">
      <div className="flex items-center justify-between border-b border-line pb-3">
        <div>
          <p className="text-sm font-semibold text-paper">Custos</p>
          <p className="text-xs text-muted mt-0.5">Total: {formatBRLFromCents(totalCents)}</p>
        </div>
        <button
          type="button"
          className="btn-secondary !py-1.5 !px-3 text-xs flex items-center gap-1"
          onClick={onAdd}
        >
          <Plus size={12} />
          Adicionar
        </button>
      </div>

      {costs.length === 0 ? (
        <p className="text-center text-sm text-muted py-4">Nenhum custo cadastrado</p>
      ) : (
        <div className="space-y-2">
          {costs.map((cost) => (
            <div
              key={cost.id}
              className="flex items-center justify-between rounded-lg border border-line bg-panel px-3 py-2.5 hover:border-teal-border transition-colors group"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className={`size-2 rounded-full shrink-0 ${cost.cost_type === 'material' ? 'bg-emerald-500' : 'bg-purple-500'}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-paper truncate">{cost.label}</p>
                  <p className="text-xs text-muted">{cost.cost_type === 'material' ? 'Materiais' : 'Adicional'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono text-base font-bold text-paper mr-2">
                  {formatBRLFromCents(cost.amount_cents)}
                </span>
                <button
                  type="button"
                  aria-label={`Editar ${cost.label}`}
                  className="rounded p-1.5 text-muted hover:text-paper transition-colors opacity-0 group-hover:opacity-100"
                  onClick={() => onEdit(cost)}
                >
                  <Pencil size={13} />
                </button>
                <button
                  type="button"
                  aria-label={`Excluir ${cost.label}`}
                  className="rounded p-1.5 text-muted hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                  onClick={() => onDelete(cost.id)}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Service Fees List (same as products)
interface ServiceFeesListProps {
  fees: ServiceFeeRecord[]
  onEdit: (fee: ServiceFeeRecord) => void
  onDelete: (id: string) => void
  onAdd: () => void
}

export function ServiceFeesList({ fees, onEdit, onDelete, onAdd }: ServiceFeesListProps) {
  const totalPercent = fees.reduce((sum, f) => sum + Number(f.percent), 0)

  return (
    <div className="surface p-5 space-y-3">
      <div className="flex items-center justify-between border-b border-line pb-3">
        <div>
          <p className="text-sm font-semibold text-paper">Taxas e encargos</p>
          <p className="text-xs text-muted mt-0.5">Total: {formatPercent(totalPercent)}</p>
        </div>
        <button
          type="button"
          className="btn-secondary !py-1.5 !px-3 text-xs flex items-center gap-1"
          onClick={onAdd}
        >
          <Plus size={12} />
          Adicionar
        </button>
      </div>

      {fees.length === 0 ? (
        <p className="text-center text-sm text-muted py-4">Nenhuma taxa cadastrada</p>
      ) : (
        <div className="space-y-2">
          {fees.map((fee) => (
            <div
              key={fee.id}
              className="flex items-center justify-between rounded-lg border border-line bg-panel px-3 py-2.5 hover:border-teal-border transition-colors group"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className={`size-2 rounded-full shrink-0 ${fee.fee_type === 'variable' ? 'bg-orange-500' : 'bg-red-500'}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-paper truncate">{fee.label}</p>
                  <p className="text-xs text-muted">{fee.fee_type === 'variable' ? 'Taxas variáveis' : 'Impostos'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`font-mono text-base font-bold mr-2 ${fee.fee_type === 'variable' ? 'text-orange-500' : 'text-red-500'}`}>
                  {formatPercent(fee.percent)}
                </span>
                <button
                  type="button"
                  aria-label={`Editar ${fee.label}`}
                  className="rounded p-1.5 text-muted hover:text-paper transition-colors opacity-0 group-hover:opacity-100"
                  onClick={() => onEdit(fee)}
                >
                  <Pencil size={13} />
                </button>
                <button
                  type="button"
                  aria-label={`Excluir ${fee.label}`}
                  className="rounded p-1.5 text-muted hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                  onClick={() => onDelete(fee.id)}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
