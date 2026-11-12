import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Copy, LoaderCircle, Package, Pencil, Plus, Search, Trash2, LayoutGrid, List } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { EmptyState, InlineNotice, LoadingScreen } from '../components/Feedback'
import { formatBRLFromCents, parseBrazilianCurrency } from '../lib/money'
import { supabase } from '../lib/supabase'
import { CurrencyInput } from '../components/CurrencyInput'

type ItemRecord = {
  id: string
  company_id: string
  name: string
  unit_price_cents: number
  unit_measure: string
  is_fractional: boolean
  created_at: string
  updated_at: string
}

type ItemDraft = {
  name: string
  unit_price_cents: number
  unit_measure: string
  is_fractional: boolean
}

const unitMeasures = [
  'Unidade',
  'Kg',
  'g',
  'L',
  'm',
  'cm',
  'mm',
  'm²',
  'm³',
  'Pacote',
  'Caixa',
  'Dúzia',
]

export default function CadastroPage() {
  const { currentCompany, configReady } = useAuth()
  const [items, setItems] = useState<ItemRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<ItemRecord | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    unit_measure: 'Unidade',
    is_fractional: false,
  })
  const [saving, setSaving] = useState(false)
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards')

  const refresh = useCallback(async () => {
    if (!currentCompany || !configReady || !supabase) {
      setItems([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data, error: fetchError } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('company_id', currentCompany.id)
        .order('name', { ascending: true })

      if (fetchError) throw fetchError
      setItems((data as ItemRecord[]) ?? [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao carregar itens.')
    } finally {
      setLoading(false)
    }
  }, [currentCompany?.id, configReady])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const filtered = items.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase())
  )

  function startCreate() {
    setEditing(null)
    setFormData({
      name: '',
      price: '',
      unit_measure: 'Unidade',
      is_fractional: false,
    })
    setError(null)
    setNotice(null)
    setShowForm(true)
  }

  function startEdit(item: ItemRecord) {
    setEditing(item)
    setFormData({
      name: item.name,
      price: (Number(item.unit_price_cents) / 100).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
      }),
      unit_measure: item.unit_measure,
      is_fractional: item.is_fractional,
    })
    setError(null)
    setNotice(null)
    setShowForm(true)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!currentCompany || !supabase) return

    const priceCents = parseBrazilianCurrency(formData.price)
    if (!formData.name.trim() || priceCents === null || priceCents < 0) {
      setError('Confira o nome e o valor unitário.')
      return
    }

    setSaving(true)
    setError(null)

    const draft: ItemDraft = {
      name: formData.name.trim(),
      unit_price_cents: priceCents,
      unit_measure: formData.unit_measure,
      is_fractional: formData.is_fractional,
    }

    try {
      if (editing) {
        const { error: updateError } = await supabase
          .from('inventory_items')
          .update(draft)
          .eq('id', editing.id)
          .eq('company_id', currentCompany.id)

        if (updateError) throw updateError
        setNotice('Item atualizado com sucesso.')
      } else {
        const { error: insertError } = await supabase
          .from('inventory_items')
          .insert({ ...draft, company_id: currentCompany.id })

        if (insertError) throw insertError
        setNotice('Item cadastrado com sucesso.')
      }

      setShowForm(false)
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o item.')
    } finally {
      setSaving(false)
    }
  }

  async function duplicate(item: ItemRecord) {
    if (!currentCompany || !supabase) return
    try {
      const { error: insertError } = await supabase.from('inventory_items').insert({
        company_id: currentCompany.id,
        name: `${item.name} (cópia)`,
        unit_price_cents: item.unit_price_cents,
        unit_measure: item.unit_measure,
        is_fractional: item.is_fractional,
      })

      if (insertError) throw insertError
      setNotice(`"${item.name}" foi duplicado.`)
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível duplicar.')
    }
  }

  async function deleteItem(item: ItemRecord) {
    if (!currentCompany || !supabase || !window.confirm(`Excluir "${item.name}"?`))
      return
    try {
      const { error: deleteError } = await supabase
        .from('inventory_items')
        .delete()
        .eq('id', item.id)
        .eq('company_id', currentCompany.id)

      if (deleteError) throw deleteError
      setNotice('Item excluído.')
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível excluir.')
    }
  }

  if (loading) return <LoadingScreen label="Carregando itens cadastrados" />

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow text-gold">CADASTRO DE ITENS</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight">Itens do estoque</h2>
          <p className="mt-2 text-sm text-muted">
            Cadastre materiais e insumos que serão usados na composição de produtos e serviços.
          </p>
        </div>
        {!showForm && (
          <button className="btn-primary w-fit" onClick={startCreate}>
            <Plus size={16} />
            Cadastrar item
          </button>
        )}
      </div>

      {notice && <InlineNotice tone="success">{notice}</InlineNotice>}
      {error && !showForm && <InlineNotice>{error}</InlineNotice>}

      {/* FORM */}
      {showForm && (
        <section className="surface p-5 sm:p-7 space-y-5">
          <div className="flex items-start justify-between border-b border-line pb-4">
            <div>
              <p className="eyebrow text-gold">
                {editing ? 'EDITAR ITEM' : 'NOVO ITEM'}
              </p>
              <h3 className="mt-1 text-xl font-bold">
                {editing ? 'Atualizar cadastro' : 'Cadastrar item'}
              </h3>
            </div>
            <button
              className="btn-secondary !px-3 !py-2 text-xs"
              onClick={() => {
                setShowForm(false)
                setError(null)
              }}
            >
              Cancelar
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="mb-2 block text-xs font-medium text-paper">
                  Nome do item
                </span>
                <input
                  className="field"
                  maxLength={160}
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Ex.: Madeira MDF"
                />
              </label>

              <label>
                <span className="mb-2 block text-xs font-medium text-paper">
                  Valor unitário (R$)
                </span>
                <CurrencyInput
                  className="field"
                  required
                  value={formData.price}
                  onChange={(value) => setFormData({ ...formData, price: value })}
                  placeholder="0,00"
                />
              </label>

              <label>
                <span className="mb-2 block text-xs font-medium text-paper">
                  Unidade de medida
                </span>
                <select
                  className="field"
                  value={formData.unit_measure}
                  onChange={(e) =>
                    setFormData({ ...formData, unit_measure: e.target.value })
                  }
                >
                  {unitMeasures.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-2 text-sm text-paper sm:col-span-2">
                <input
                  type="checkbox"
                  checked={formData.is_fractional}
                  onChange={(e) =>
                    setFormData({ ...formData, is_fractional: e.target.checked })
                  }
                  className="accent-[#C8FF00]"
                />
                Permitir uso fracionado na composição de produtos/serviços
              </label>
            </div>

            {error && <InlineNotice>{error}</InlineNotice>}

            <div className="flex flex-col-reverse justify-end gap-2 border-t border-line pt-4 sm:flex-row">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setShowForm(false)
                  setError(null)
                }}
              >
                Cancelar
              </button>
              <button className="btn-primary" disabled={saving}>
                {saving ? (
                  <LoaderCircle className="animate-spin" size={15} />
                ) : (
                  <Plus size={15} />
                )}
                {editing ? 'Atualizar item' : 'Salvar item'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* LIST */}
      {!showForm && (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                className="field pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pesquisar item"
              />
            </label>
            {/* Toggle visualização Cards/Lista */}
            <div className="inline-flex rounded-xl border border-line bg-panel p-1">
              <button 
                onClick={() => setViewMode('cards')} 
                className={`rounded-lg px-3 py-2 transition-colors ${viewMode === 'cards' ? 'bg-gold text-black' : 'text-muted hover:text-paper'}`}
                title="Visualizar em cards"
                aria-label="Visualizar em cards"
              >
                <LayoutGrid size={16} />
              </button>
              <button 
                onClick={() => setViewMode('list')} 
                className={`rounded-lg px-3 py-2 transition-colors ${viewMode === 'list' ? 'bg-gold text-black' : 'text-muted hover:text-paper'}`}
                title="Visualizar em lista"
                aria-label="Visualizar em lista"
              >
                <List size={16} />
              </button>
            </div>
          </div>

          {items.length === 0 ? (
            <EmptyState
              title="Cadastre seu primeiro item"
              description="Materiais e insumos que compõem seus produtos e serviços."
              action={
                <button className="btn-primary" onClick={startCreate}>
                  <Plus size={15} />
                  Cadastrar primeiro item
                </button>
              }
            />
          ) : (
            <div className="space-y-4">
              <div className="surface px-5 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="eyebrow">ITENS CADASTRADOS</p>
                    <p className="mt-1 text-xs text-muted">
                      {filtered.length} de {items.length} item(ns)
                    </p>
                  </div>
                  <Package className="text-gold" size={18} />
                </div>
              </div>

              {/* Grid de cards OU tabela de lista */}
              {viewMode === 'cards' ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((item) => (
                  <div
                    key={item.id}
                    className="surface overflow-hidden hover:border-teal-border transition-all group"
                  >
                    {/* Header do card */}
                    <div className="border-b border-line px-4 py-3">
                      <h4 className="text-sm font-semibold line-clamp-1">
                        {item.name}
                      </h4>
                      <p className="mt-1 text-[10px] text-muted">
                        {item.is_fractional ? 'Fracionável' : 'Não fracionável'}
                      </p>
                    </div>

                    {/* Corpo do card */}
                    <div className="p-4 space-y-3">
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-muted">
                          Valor unitário
                        </p>
                        <p className="mt-1 font-mono text-xl font-bold">
                          {formatBRLFromCents(item.unit_price_cents)}
                        </p>
                      </div>

                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-muted">
                          Unidade de medida
                        </p>
                        <p className="mt-1 text-sm font-medium">
                          {item.unit_measure}
                        </p>
                      </div>
                    </div>

                    {/* Footer com ações */}
                    <div className="border-t border-line px-3 py-2 bg-white/[.01] flex items-center justify-end gap-1">
                      <button
                        aria-label={`Editar ${item.name}`}
                        title="Editar"
                        className="rounded p-2 text-muted hover:text-paper transition-colors"
                        onClick={() => startEdit(item)}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        aria-label={`Duplicar ${item.name}`}
                        title="Duplicar"
                        className="rounded p-2 text-muted hover:text-gold transition-colors"
                        onClick={() => void duplicate(item)}
                      >
                        <Copy size={13} />
                      </button>
                      <button
                        aria-label={`Excluir ${item.name}`}
                        title="Excluir"
                        className="rounded p-2 text-muted hover:text-red-400 transition-colors"
                        onClick={() => void deleteItem(item)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  ))}
                </div>
              ) : (
                /* Visualização em lista (tabela) */
                <div className="surface overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px] text-left">
                      <thead>
                        <tr className="border-b border-line text-[10px] uppercase tracking-[.14em] text-muted">
                          <th className="px-5 py-3">Item</th>
                          <th className="px-3 py-3">Valor unitário</th>
                          <th className="px-3 py-3">Unidade</th>
                          <th className="px-3 py-3">Fracionável</th>
                          <th className="px-4 py-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {filtered.map((item) => (
                          <tr key={item.id} className="hover:bg-teal-light/20 transition-colors">
                            <td className="px-5 py-4">
                              <p className="text-sm font-medium">{item.name}</p>
                            </td>
                            <td className="px-3 py-4 font-mono text-sm">
                              {formatBRLFromCents(item.unit_price_cents)}
                            </td>
                            <td className="px-3 py-4 text-sm text-muted">
                              {item.unit_measure}
                            </td>
                            <td className="px-3 py-4 text-xs">
                              {item.is_fractional ? (
                                <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-emerald-700 font-medium">
                                  Sim
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-gray-600">
                                  Não
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-4">
                              <div className="flex justify-end gap-1">
                                <button
                                  aria-label={`Editar ${item.name}`}
                                  title="Editar"
                                  className="rounded p-2 text-muted hover:text-paper transition-colors"
                                  onClick={() => startEdit(item)}
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  aria-label={`Duplicar ${item.name}`}
                                  title="Duplicar"
                                  className="rounded p-2 text-muted hover:text-gold transition-colors"
                                  onClick={() => void duplicate(item)}
                                >
                                  <Copy size={14} />
                                </button>
                                <button
                                  aria-label={`Excluir ${item.name}`}
                                  title="Excluir"
                                  className="rounded p-2 text-muted hover:text-red-400 transition-colors"
                                  onClick={() => void deleteItem(item)}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {filtered.length === 0 && (
                <div className="surface p-8 text-center">
                  <p className="text-sm text-muted">
                    Nenhum item corresponde à pesquisa.
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
