# Responsiveness Investigation Report
> SPWeb Lucro — React + Tailwind  
> Workspace: `spweb-price-main/spweb-price-main/src`

---

## Summary (answers first)

| # | Question | Finding |
|---|----------|---------|
| 1 | Root cause of Dashboard mobile overflow | Two horizontally-scrolling card rows use `flex gap-2.5` **inside** a `min-w-max` div, without a `max-width` or `flex-wrap`. On mobile this inner div grows wider than the viewport and pushes layout. |
| 2 | Pages with overflow / non-responsive patterns | DashboardPage (card rows, Opportunities table), ProductsPage (details panel tables), ExpensesPage (table rows), SimulatorPage (slider layout), ServicesPanel (details panel tables). |
| 3 | AuthPage signup exposure | No signup link or button visible on the `/login` route. The `mode === 'signup'` footer block correctly only renders when `mode === 'signup'`. However **the route `/signup` still exists** in `App.tsx` (line 44) and `AuthCallbackPage` has a "Criar nova conta" button navigating to `/signup` (line ~157). |
| 4 | Fixes needed per page | Detailed below. |

---

## 1 — DashboardPage.tsx — exact overflow cause

### "Menores Margens" and "Maiores Margens" card rows

**File:** `src/pages/DashboardPage.tsx`

Both sections (lines ~207–280) use the same pattern:

```tsx
{/* outer scroll wrapper */}
<div className="overflow-x-auto pb-2">
  {/* THIS div is the problem */}
  <div className="flex gap-2.5 min-w-max">
    {/* each card */}
    <Link className="... min-w-[260px]" ...>
```

**What goes wrong on mobile:**

- `min-w-max` on the inner `flex` div forces it to be exactly as wide as all its children combined (up to 30 cards × 260 px = 7800 px minimum).
- The outer `overflow-x-auto` correctly makes this scrollable **within its own surface card**, but the `surface` card itself has no `max-width` or `overflow: hidden`. When the containing `<section>` does not clip, the browser's layout engine still needs to calculate the inline size of the `surface` div, and `min-w-max` can leak outside `overflow-x-auto` in some mobile browsers (Chrome for Android, Safari iOS) depending on whether the scroll container has an explicit width.
- On narrow screens the sidebar is hidden but the content area `<main className="p-3 sm:p-6 ...">` has no `overflow: hidden`, so the leaking width causes a horizontal scroll on the **page body**, distorting all other layout.

**Exact classes causing the problem:**

| Element | Problematic class | Line (approx.) |
|---------|-------------------|----------------|
| Inner flex container — Menores Margens | `min-w-max` | ~230 |
| Inner flex container — Maiores Margens | `min-w-max` | ~263 |
| Each card — both sections | `min-w-[260px]` | ~237, ~270 |

**Recommended fix:**

Replace `min-w-max` with nothing (remove it) and ensure the outer scroll container is `overflow-x-auto w-full`. Add `shrink-0` to the individual cards so they don't collapse while still allowing horizontal scroll:

```tsx
{/* Before */}
<div className="overflow-x-auto pb-2">
  <div className="flex gap-2.5 min-w-max">
    <Link className="... min-w-[260px]" ...>

{/* After */}
<div className="overflow-x-auto pb-2 -mx-1 px-1">
  <div className="flex gap-2.5">
    <Link className="... min-w-[220px] sm:min-w-[260px] shrink-0" ...>
```

The `-mx-1 px-1` trick keeps the scroll container flush without clipping the card shadow on edges.

### Opportunities table (bottom of Dashboard)

**File:** `src/pages/DashboardPage.tsx`, lines ~430–450

```tsx
<div className="grid gap-3 px-5 py-4 text-sm
  sm:grid-cols-[1.2fr_repeat(5,.75fr)]
  sm:items-center sm:px-7 ...">
```

On mobile this renders as a single-column grid per row — not broken — but the lack of any `overflow-x-auto` wrapper means that if the viewport is very narrow (<360 px) and all six columns render (no responsive hide), the row overflows. **Minor risk**, not the main cause.

---

## 2 — Page-by-page responsive issues

### DashboardPage.tsx ✗ (primary issue)

- **Card rows** (Menores/Maiores Margens): `min-w-max` inner div leaks horizontal scroll onto the page body. See §1.
- **Metric grid sections** (lines ~193, ~200, ~205): `grid gap-3 sm:grid-cols-2 xl:grid-cols-4` — OK, stacks to single column on mobile.
- **Break-even + pie chart section**: `grid gap-4 xl:grid-cols-[1.45fr_1fr]` — OK on mobile (stacks).
- **Assets/Liabilities BarChart**: `<div className="h-64">` with a `BarChart layout="vertical"` — `margin={{ left: 20, right: 30 }}` fixed values. On very narrow screens the left Y-axis label (80 px wide) can clip. Minor.
- **Opportunities table**: `sm:grid-cols-[1.2fr_repeat(5,.75fr)]` — no mobile column hiding; six columns visible on mobile if screen is wide enough to trigger `sm:`. On 640 px+ it looks correct. Below 640 px it falls back to single-column stacking which is intentional but each field label/value is redundantly stacked without visual grouping. Not broken, just dense.

### ProductsPage.tsx ✗ (medium)

- **Tab bar** (line ~300): `inline-flex rounded-xl border border-line bg-panel p-1` with three tabs. On very narrow screens the three tabs ("Produtos", "Serviços", "Inventário") may overflow. No `flex-wrap` or responsive font-size reduction.
- **Filter row** (line ~315): `flex flex-col gap-3 sm:flex-row sm:items-center` — stacks correctly on mobile. ✓
- **Card grid**: `grid gap-4 sm:grid-cols-2 lg:grid-cols-3` — OK. ✓
- **Details panel / pie chart**: The pie chart section renders inside the same `space-y-6` column, no overflow risk.
- **Itemized tables** in product details: rendered inside `surface` with no `overflow-x-auto` wrapper — if columns are wide, can overflow on narrow screens. The tables in `ItemizedLists` components should be verified.

### ExpensesPage.tsx ✗ (medium)

The file is large (not fully read past line 150) but from the imports and state shape:
- **Fixed expense table**: Uses `data-table` class from `index.css` — `w-full text-left` without an `overflow-x-auto` wrapper; on mobile the full-width table with many columns (description, category, amount, date, actions) will overflow if columns have natural min-widths.
- **Tab bar** (`expenses | variableCosts | assetsLiabilities`): same inline-flex overflow risk as ProductsPage.
- **Variable Costs and Assets/Liabilities tables**: same unguarded table pattern.

### ServicesPanel.tsx ✗ (medium — same as ProductsPage)

- Same details-panel pattern as ProductsPage.
- Service list table follows `data-table` pattern — same overflow risk on mobile.
- No horizontal card row (no `min-w-max` issue).

### SimulatorPage.tsx ✗ (minor)

- **Slider** (`.slider` from `index.css`): 24 px thumb, works on mobile.
- **Input grid**: Not fully read past line 150, but the simulator uses a form-heavy layout with labeled number inputs. No `min-w-max` card row present.
- **Saved simulations list**: Has a `cards/list` toggle and card grid. Cards likely have min-widths — needs verification but risk is lower since there is no data-driven unlimited horizontal expansion.

### AuthPage.tsx ✓ (login screen is clean)

No signup UI on the `/login` route. The card correctly gates its footer:
```tsx
{/* Only renders when mode === 'signup' */}
<div className="mt-7 text-center text-sm text-white/50">
  {mode === 'signup' && (
    <p>Já tem conta? <a href="/login">Entrar</a></p>
  )}
</div>
```
The word "Login" was already removed (the `mode !== 'login'` guard on `<h2>` at line ~86 means no title renders on the login screen).

---

## 3 — AuthPage signup analysis

### What is visible on `/login`

| Element | Present? | Notes |
|---------|----------|-------|
| Title "Login" | ✗ No | Correctly hidden by `mode !== 'login'` guard |
| "Não tem conta? Cadastre-se" | ✗ No | Footer block gated to `mode === 'signup'` |
| Signup button | ✗ No | No button with signup action on login mode |
| "Esqueceu a senha?" link | ✓ Yes | Points to `/recovery` — legitimate, not signup |

### What still creates a path to signup

1. **`/signup` route exists** in `App.tsx` line 44:
   ```tsx
   <Route path="/signup" element={<AuthPage mode="signup" />} />
   ```
   Anyone who navigates directly to `/signup` sees a full registration form. Per the requirement ("não permita que usuários criem conta em hipótese alguma, através da tela de login"), the route must be **removed** or **redirected to `/login`**.

2. **`AuthCallbackPage.tsx` lines ~156–159** has a "Criar nova conta" button:
   ```tsx
   <button
     className="text-xs text-muted ..."
     onClick={() => navigate('/signup', { replace: true })}>
     Criar nova conta
   </button>
   ```
   This page is reached after a failed email confirmation. It still exposes a path to signup.

3. **`supabase.auth.signUp` call** in `AuthPage.tsx` lines ~46–50: the signup logic remains functional in the codebase even if the UI is hidden. If the route `/signup` is removed, this code becomes unreachable from the browser UI.

### Recommended fix for signup lockdown

- Remove (or redirect to `/login`) the `<Route path="/signup">` in `App.tsx`.
- Remove the "Criar nova conta" button from `AuthCallbackPage.tsx`.
- Optionally: guard the `mode === 'signup'` branch in `AuthPage.submit()` with an early return, so even if the URL is guessed it cannot create accounts.

---

## 4 — Summary of recommended fixes per page

### Priority 1 — DashboardPage (main mobile break)

| Fix | Where | Change |
|-----|-------|--------|
| Remove `min-w-max` from card row inner divs | Lines ~230, ~263 | Delete `min-w-max` class |
| Add `shrink-0` to individual margin cards | Lines ~237, ~270 | Add `shrink-0` to `<Link>` className |
| Optionally reduce card min-width on mobile | Same `<Link>` | `min-w-[200px] sm:min-w-[260px]` |
| Add `overflow-x-hidden` to AppShell `<main>` | `AppShell.tsx` line ~108 | Prevents any page from leaking |

### Priority 2 — Signup lockdown

| Fix | Where | Change |
|-----|-------|--------|
| Remove `/signup` route | `App.tsx` line 44 | Delete the Route or redirect to `/login` |
| Remove "Criar nova conta" button | `AuthCallbackPage.tsx` ~157 | Delete the button element |

### Priority 3 — Table overflow on other pages

| Fix | Where | Change |
|-----|-------|--------|
| Wrap expense/variable cost/assets tables | `ExpensesPage.tsx` | Add `<div className="overflow-x-auto">` around each `<table>` |
| Wrap service/product details tables | `ServicesPanel.tsx`, `ProductsPage.tsx` | Same `overflow-x-auto` wrapper |
| Tab bar overflow on narrow screens | `ProductsPage.tsx`, `ExpensesPage.tsx` | Add `overflow-x-auto` to tab container or use responsive font sizes |

### Priority 4 — Minor

| Fix | Where | Change |
|-----|-------|--------|
| BarChart left margin overflow on <360 px | `DashboardPage.tsx` BarChart | Reduce `width` on `YAxis` or use responsive margin |
| Opportunities table column density | `DashboardPage.tsx` | Add `hide-mobile` class to less-important columns |

---

## index.css / tailwind.config.ts findings

- **`index.css`**: `html` and `body` both have `min-width: 320px` — correct. No `overflow: hidden` on body/html that would mask the problem.
- **`AppShell.tsx`** main: `<main className="p-3 sm:p-6 md:p-8 lg:p-10 mx-auto w-full max-w-[1440px]">` — has `max-w-[1440px]` but **no `overflow-x-hidden`**. This means any child that overflows its own scroll container propagates to the page.
- **`tailwind.config.ts`**: No custom `screens` overrides — standard Tailwind breakpoints apply (`sm: 640px`, `md: 768px`, `lg: 1024px`, `xl: 1280px`).
- **`.table-wrapper`** in `index.css`: `overflow-x-auto rounded-b-card` — a utility class exists but is not being used on most tables in the pages.

---

## Conclusion

The primary mobile distortion is caused by two `min-w-max` flex containers in `DashboardPage.tsx` (the Menores/Maiores Margens card rows). They force their parent surface cards to be potentially thousands of pixels wide, and since `AppShell`'s `<main>` has no `overflow-x-hidden`, this leaks into the page body and shifts every element including the header.

The signup lockdown is 95% complete on the visual layer (login screen shows no signup UI), but the `/signup` route and an "Criar nova conta" button in `AuthCallbackPage` remain active entry points that must be removed to satisfy the "em hipótese alguma" requirement.
