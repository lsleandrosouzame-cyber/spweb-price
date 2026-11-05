import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Copy, Eye, History, LoaderCircle, Package, Pencil, Plus, Search, Trash2, Wrench, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { EmptyState, InlineNotice, LoadingScreen } from '../components/Feedback'
import { calculateProductPricing } from '../finance/pricing'
import { formatBRLFromCents, formatMarkup, formatPercent, parseBrazilianCurrency } from '../lib/money'
import { listProducts, removeProduct, saveProduct } from '../services/companyData'
import type { ProductDraft, ProductRecord } from '../types/database'
import { supabase } from '../lib/supabase'
import { CurrencyInput } from '../components/CurrencyInput'
import ServicesPanel from './ServicesPanel'

const blank = { name: '', acquisition: '', other: '0', fees: '0', taxes: '0', desired: '', price: '', notes: '' }
const inputLabel = 'mb-2 block text-xs font-medium text-[#c7c7c7]'

export default function ProductsPage() {
  const { currentCompany, configReady } = useAuth()
  const [rows, setRows] = useState<ProductRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'todos' | 'saudavel' | 'atencao' | 'negativa'>('todos')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ProductRecord | null>(null)
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)
  const [history, setHistory] = useState<any[] | null>(null)
  const [selectedDetails, setSelectedDetails] = useState<ProductRecord | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [tab, setTab] = useState<'products' | 'services'>('products')

  const refresh = useCallback(async () => {
    if (!currentCompany || !configReady) { setRows([]); setLoading(false); return }
    setLoading(true); setError(null)
    try { setRows(await listProducts(currentCompany.id)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Falha ao carregar produtos.') }
    finally { setLoading(false) }
  }, [currentCompany?.id, configReady])

  useEffect(() => { void refresh() }, [refresh])

  const filtered = useMemo(() => rows.filter(row => {
    if (!row.name.toLowerCase().includes(search.toLowerCase())) return false
    const margin = row.current_price_cents ? calculateProductPricing({ acquisitionCostCents: Number(row.acquisition_cost_cents), otherCostCents: Number(row.other_cost_cents), variableFeesPercent: Number(row.variable_fees_percent), taxPercent: Number(row.tax_percent), desiredMarginPercent: row.desired_margin_percent === null ? undefined : Number(row.desired_margin_percent), sellingPriceCents: Number(row.current_price_cents) }).contributionMarginPercent : null
    if (filter === 'todos') return true
    if (margin === null) return false
    if (filter === 'negativa') return margin < 0
    if (filter === 'atencao') return margin >= 0 && row.desired_margin_percent !== null && margin < Number(row.desired_margin_percent)
    return margin >= 0 && (row.desired_margin_percent === null || margin >= Number(row.desired_margin_percent))
  }), [rows, search, filter])
  const selectedPricing = selectedDetails ? calculateProductPricing({ acquisitionCostCents: Number(selectedDetails.acquisition_cost_cents), otherCostCents: Number(selectedDetails.other_cost_cents), variableFeesPercent: Number(selectedDetails.variable_fees_percent), taxPercent: Number(selectedDetails.tax_percent), desiredMarginPercent: selectedDetails.desired_margin_percent === null ? undefined : Number(selectedDetails.desired_margin_percent), sellingPriceCents: selectedDetails.current_price_cents === null ? undefined : Number(selectedDetails.current_price_cents) }) : null

  function startCreate() { setEditing(null); setForm(blank); setNotice(null); setOpen(true) }
  function startEdit(row: ProductRecord) {
    setEditing(row); setNotice(null)
    const money = (cents: number | null) => cents === null ? '' : (Number(cents) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
    setForm({ name: row.name, acquisition: money(Number(row.acquisition_cost_cents)), other: money(Number(row.other_cost_cents)), fees: String(row.variable_fees_percent), taxes: String(row.tax_percent), desired: row.desired_margin_percent === null ? '' : String(row.desired_margin_percent), price: money(row.current_price_cents), notes: row.notes ?? '' })
    setOpen(true)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!currentCompany) return
    const acquisition = parseBrazilianCurrency(form.acquisition)
    const other = parseBrazilianCurrency(form.other || '0')
    const price = form.price.trim() ? parseBrazilianCurrency(form.price) : null
    const fees = Number(form.fees.replace(',', '.'))
    const taxes = Number(form.taxes.replace(',', '.'))
    const desired = form.desired.trim() ? Number(form.desired.replace(',', '.')) : null
    if (!form.name.trim() || acquisition === null || other === null || !Number.isFinite(fees) || !Number.isFinite(taxes) || (form.desired.trim() && (desired === null || !Number.isFinite(desired))) || (form.price.trim() && price === null)) {
      setError('Confira nome, custos, percentuais, margem e preço informados.'); return
    }
    let calculated
    try { calculated = calculateProductPricing({ acquisitionCostCents: acquisition, otherCostCents: other, variableFeesPercent: fees, taxPercent: taxes, desiredMarginPercent: desired ?? undefined, sellingPriceCents: price ?? undefined }) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Percentuais incompatíveis.'); return }
    setSaving(true); setError(null)
    const draft: ProductDraft = { name: form.name.trim(), acquisition_cost_cents: acquisition, other_cost_cents: other, variable_fees_percent: fees, tax_percent: taxes, desired_margin_percent: desired, current_price_cents: price, notes: form.notes.trim() || null }
    try {
      await saveProduct(currentCompany.id, draft, editing?.id)
      setOpen(false); setNotice(editing ? 'Produto atualizado.' : 'Produto salvo.'); await refresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar. Verifique a conexão e as policies Supabase.') }
    finally { setSaving(false) }
    void calculated
  }

  async function duplicate(row: ProductRecord) {
    if (!currentCompany) return
    try {
      const { id: _id, company_id: _company, created_at: _created, updated_at: _updated, ...copy } = row
      await saveProduct(currentCompany.id, { ...copy, name: `${row.name} (cópia)` })
      setNotice(`“${row.name}” foi duplicado.`); await refresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível duplicar.') }
  }

  async function deleteRow(row: ProductRecord) {
    if (!currentCompany || !window.confirm(`Excluir “${row.name}”? Essa ação não pode ser desfeita.`)) return
    try { await removeProduct(currentCompany.id, row.id); setNotice('Produto excluído.'); await refresh() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível excluir.') }
  }

  async function showHistory(row: ProductRecord) {
    if (!supabase) return
    const { data, error: historyError } = await supabase.from('pricing_history').select('id, snapshot, created_at').eq('company_id', row.company_id).eq('item_id', row.id).eq('item_type', 'product').order('created_at', { ascending: false }).limit(20)
    if (historyError) { setError(historyError.message); return }
    setHistory(data ?? [])
  }

  if (loading) return <LoadingScreen label="Carregando produtos cadastrados" />
  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="eyebrow text-gold">CATÁLOGO FINANCEIRO</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">Produtos e serviços</h2><p className="mt-2 text-sm text-muted">Veja quanto cada venda contribui para a operação.</p></div>{tab === 'products' && <button className="btn-primary w-fit" onClick={startCreate}><Plus size={16}/>Cadastrar produto</button>}</div>
    <div className="inline-flex rounded-xl border border-line bg-[#101010] p-1"><button onClick={() => setTab('products')} className={`rounded-lg px-4 py-2.5 text-xs font-medium ${tab === 'products' ? 'bg-gold text-ink' : 'text-muted'}`}><Package size={14} className="mr-2 inline"/>Produtos</button><button onClick={() => setTab('services')} className={`rounded-lg px-4 py-2.5 text-xs font-medium ${tab === 'services' ? 'bg-gold text-ink' : 'text-muted'}`}><Wrench size={14} className="mr-2 inline"/>Serviços</button></div>
    {tab === 'services' ? <ServicesPanel/> : <>
    {notice && <InlineNotice tone="success">{notice}</InlineNotice>}{error && <InlineNotice>{error}</InlineNotice>}
    <div className="flex flex-col gap-3 sm:flex-row"><label className="relative flex-1"><Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"/><input className="field pl-10" value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar produto" /></label><select aria-label="Filtrar situação da margem" className="field sm:w-56" value={filter} onChange={e => setFilter(e.target.value as typeof filter)}><option value="todos">Todas as margens</option><option value="saudavel">Margem saudável</option><option value="atencao">Abaixo da desejada</option><option value="negativa">Margem negativa</option></select></div>
    {rows.length === 0 ? <EmptyState title="Seu catálogo começa aqui" description="Cadastre um produto com seu custo de aquisição, outros custos e preço atual. O SPWeb Lucro calcula margem e resultado sem preencher valores fictícios." action={<button className="btn-primary" onClick={startCreate}><Plus size={15}/>Cadastrar primeiro produto</button>}/> : <div className="surface overflow-hidden"><div className="flex items-center justify-between border-b border-line px-5 py-4"><div><p className="eyebrow">PRODUTOS DA EMPRESA</p><p className="mt-1 text-xs text-muted">{filtered.length} de {rows.length} item(ns)</p></div><Package className="text-gold" size={18}/></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead><tr className="border-b border-line text-[10px] uppercase tracking-[.14em] text-muted"><th className="px-5 py-3 font-medium">Produto</th><th className="px-3 py-3 font-medium">Custo total</th><th className="px-3 py-3 font-medium">Preço atual</th><th className="px-3 py-3 font-medium">Margem</th><th className="px-3 py-3 font-medium">Markup</th><th className="px-3 py-3 font-medium">Resultado / un.</th><th className="px-3 py-3 font-medium">Situação</th><th className="px-4 py-3"/></tr></thead><tbody className="divide-y divide-line">{filtered.map(row => {
        const result = row.current_price_cents ? calculateProductPricing({ acquisitionCostCents: Number(row.acquisition_cost_cents), otherCostCents: Number(row.other_cost_cents), variableFeesPercent: Number(row.variable_fees_percent), taxPercent: Number(row.tax_percent), desiredMarginPercent: row.desired_margin_percent === null ? undefined : Number(row.desired_margin_percent), sellingPriceCents: Number(row.current_price_cents) }) : null
        const margin = result?.contributionMarginPercent ?? null
        const status = margin === null ? { label: 'Preço pendente', color: 'text-muted' } : margin < 0 ? { label: 'Margem negativa', color: 'text-negative' } : row.desired_margin_percent !== null && margin < Number(row.desired_margin_percent) ? { label: 'Abaixo da meta', color: 'text-attention' } : { label: 'Saudável', color: 'text-positive' }
        return <tr key={row.id} className="hover:bg-white/[.018]"><td className="px-5 py-4"><button type="button" className="text-left text-sm font-medium hover:text-gold" onClick={() => setSelectedDetails(row)}>{row.name}</button><p className="mt-1 max-w-[220px] truncate text-[10px] text-muted">{row.notes || 'Produto'}</p></td><td className="px-3 py-4 font-mono text-xs">{formatBRLFromCents(Number(row.acquisition_cost_cents) + Number(row.other_cost_cents))}</td><td className="px-3 py-4 font-mono text-xs">{formatBRLFromCents(row.current_price_cents)}</td><td className={`px-3 py-4 font-mono text-xs ${margin !== null && margin < 0 ? 'text-negative' : 'text-paper'}`}>{formatPercent(margin)}</td><td className="px-3 py-4 font-mono text-xs">{formatMarkup(result?.markup)}</td><td className={`px-3 py-4 font-mono text-xs ${(result?.contributionCents ?? 0) < 0 ? 'text-negative' : ''}`}>{formatBRLFromCents(result?.contributionCents)}</td><td className={`px-3 py-4 text-xs ${status.color}`}>{status.label}</td><td className="px-3 py-4"><div className="flex items-center justify-end gap-1"><button aria-label={`Detalhes de ${row.name}`} title="Detalhes" className="rounded p-2 text-muted hover:text-gold" onClick={() => setSelectedDetails(row)}><Eye size={14}/></button><button aria-label={`Histórico de ${row.name}`} title="Histórico" className="rounded p-2 text-muted hover:text-gold" onClick={() => void showHistory(row)}><History size={14}/></button><button aria-label={`Editar ${row.name}`} title="Editar" className="rounded p-2 text-muted hover:text-paper" onClick={() => startEdit(row)}><Pencil size={14}/></button><button aria-label={`Duplicar ${row.name}`} title="Duplicar" className="rounded p-2 text-muted hover:text-gold" onClick={() => void duplicate(row)}><Copy size={14}/></button><button aria-label={`Excluir ${row.name}`} title="Excluir" className="rounded p-2 text-muted hover:text-negative" onClick={() => void deleteRow(row)}><Trash2 size={14}/></button></div></td></tr>
      })}</tbody></table></div>{filtered.length === 0 && <p className="p-8 text-center text-sm text-muted">Nenhum produto corresponde à pesquisa/filtro.</p>}</div>}

    {open && <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-black/75 p-3 backdrop-blur-sm" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false) }}><section role="dialog" aria-modal="true" aria-labelledby="product-modal-title" className="my-6 w-full max-w-3xl rounded-2xl border border-line bg-[#111] shadow-2xl"><div className="flex items-start justify-between border-b border-line px-5 py-4 sm:px-7"><div><p className="eyebrow text-gold">PRECIFICAÇÃO DE PRODUTO</p><h3 id="product-modal-title" className="mt-1 text-lg font-semibold">{editing ? 'Editar produto' : 'Novo produto'}</h3></div><button aria-label="Fechar" className="rounded-lg p-2 text-muted hover:bg-white/5 hover:text-paper" onClick={() => setOpen(false)}><X size={17}/></button></div>
      <form onSubmit={submit} className="space-y-5 p-5 sm:p-7"><div className="grid gap-4 sm:grid-cols-2"><label className="sm:col-span-2"><span className={inputLabel}>Nome do produto</span><input className="field" maxLength={160} required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Kit de café especial"/></label>
        <label><span className={inputLabel}>Custo de aquisição/produção (R$)</span><CurrencyInput className="field" required value={form.acquisition} onChange={value => setForm({ ...form, acquisition: value })} placeholder="0,00"/></label><label><span className={inputLabel}>Outros custos unitários (R$)</span><CurrencyInput className="field" value={form.other} onChange={value => setForm({ ...form, other: value })} placeholder="0,00"/></label>
        <label><span className={inputLabel}>Taxas variáveis (%)</span><input className="field" type="number" min="0" max="100" step="0.01" required value={form.fees} onChange={e => setForm({ ...form, fees: e.target.value })}/></label><label><span className={inputLabel}>Impostos sobre venda (%)</span><input className="field" type="number" min="0" max="100" step="0.01" required value={form.taxes} onChange={e => setForm({ ...form, taxes: e.target.value })}/></label>
        <label><span className={inputLabel}>Preço atual (R$) · opcional</span><CurrencyInput className="field" value={form.price} onChange={value => setForm({ ...form, price: value })} placeholder="Deixe em branco se ainda não vende"/></label><label><span className={inputLabel}>Margem desejada (%) · opcional</span><input className="field" type="number" min="0" max="100" step="0.01" value={form.desired} onChange={e => setForm({ ...form, desired: e.target.value })} placeholder="Ex.: 20"/></label>
        <label className="sm:col-span-2"><span className={inputLabel}>Observação · opcional</span><textarea className="field min-h-20 resize-y" maxLength={1000} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}/></label></div>
        {error && <InlineNotice>{error}</InlineNotice>}
        <div className="flex flex-col-reverse justify-end gap-2 border-t border-line pt-4 sm:flex-row"><button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancelar</button><button className="btn-primary" disabled={saving}>{saving ? <LoaderCircle className="animate-spin" size={15}/> : <Plus size={15}/>}SALVAR PRODUTO</button></div>
      </form></section></div>}

    {selectedDetails && selectedPricing && <div className="fixed inset-0 z-[78] grid place-items-center overflow-y-auto bg-black/75 p-4" onMouseDown={event => { if (event.target === event.currentTarget) setSelectedDetails(null) }}><section role="dialog" aria-modal="true" aria-labelledby="product-details-title" className="my-5 w-full max-w-2xl rounded-2xl border border-line bg-[#111] p-5 shadow-2xl sm:p-7"><div className="flex items-start justify-between"><div><p className="eyebrow text-gold">DETALHES DA PRECIFICAÇÃO</p><h3 id="product-details-title" className="mt-1 text-lg font-semibold">{selectedDetails.name}</h3></div><button aria-label="Fechar detalhes" onClick={() => setSelectedDetails(null)} className="rounded p-2 text-muted hover:text-paper"><X size={16}/></button></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{[['Custo de aquisição', formatBRLFromCents(selectedDetails.acquisition_cost_cents)], ['Outros custos', formatBRLFromCents(selectedDetails.other_cost_cents)], ['Custo total', formatBRLFromCents(selectedPricing.totalCostCents)], ['Taxas variáveis', `${formatPercent(selectedDetails.variable_fees_percent)} · ${formatBRLFromCents(selectedPricing.feesCents)}`], ['Impostos', `${formatPercent(selectedDetails.tax_percent)} · ${formatBRLFromCents(selectedPricing.taxesCents)}`], ['Preço atual', formatBRLFromCents(selectedDetails.current_price_cents)], ['Preço mínimo', formatBRLFromCents(selectedPricing.minimumPriceCents)], ['Preço recomendado', formatBRLFromCents(selectedPricing.recommendedPriceCents)], ['Resultado estimado por unidade', formatBRLFromCents(selectedPricing.contributionCents)], ['Margem de contribuição atual', formatPercent(selectedPricing.contributionMarginPercent)], ['Margem desejada', formatPercent(selectedDetails.desired_margin_percent)], ['Markup', formatMarkup(selectedPricing.markup)]].map(([label, value]) => <div key={label} className="rounded-lg border border-line bg-[#151515] p-3"><p className="text-[10px] text-muted">{label}</p><p className="mt-1 font-mono text-sm text-paper">{value}</p></div>)}</div>{selectedDetails.notes && <p className="mt-4 border-t border-line pt-4 text-sm text-muted">{selectedDetails.notes}</p>}<div className="mt-5 flex justify-end gap-2 border-t border-line pt-4"><button className="btn-secondary" onClick={() => setSelectedDetails(null)}>Fechar</button><button className="btn-primary" onClick={() => { const row = selectedDetails; setSelectedDetails(null); startEdit(row) }}><Pencil size={14}/>Editar precificação</button></div></section></div>}

    {history && <div className="fixed inset-0 z-[80] grid place-items-center bg-black/75 p-4" onMouseDown={event => { if (event.target === event.currentTarget) setHistory(null) }}><section role="dialog" aria-modal="true" aria-labelledby="history-title" className="max-h-[80vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-line bg-[#111] p-5"><div className="flex items-center justify-between"><div><p className="eyebrow text-gold">AUDITORIA DE PREÇOS</p><h3 id="history-title" className="mt-1 text-lg font-semibold">Histórico de precificação</h3></div><button aria-label="Fechar histórico" onClick={() => setHistory(null)} className="rounded p-2 text-muted hover:text-paper"><X size={16}/></button></div>{history.length ? <div className="mt-5 divide-y divide-line">{history.map(item => <div key={item.id} className="py-3"><p className="text-xs text-muted">{new Date(item.created_at).toLocaleString('pt-BR')}</p><p className="mt-1 text-sm">Preço atual: <span className="font-mono text-gold">{formatBRLFromCents(item.snapshot.current_price_cents)}</span></p><p className="mt-1 text-xs text-muted">Custo total: {formatBRLFromCents(Number(item.snapshot.acquisition_cost_cents) + Number(item.snapshot.other_cost_cents))} · margem desejada: {formatPercent(item.snapshot.desired_margin_percent)}</p></div>)}</div> : <p className="mt-5 text-sm text-muted">Ainda não há alterações de preço registradas.</p>}</section></div>}
    </>}
  </div>
}
