'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { OpportunityCard } from '@/components/shared/OpportunityCard'
import { api } from '@/lib/api-client'
import { listarOportunidades, misPostulaciones, postular } from '@/lib/api/postulaciones'
import { useAuthStore } from '@/store/auth.store'
import type { Opportunity, OpportunityType } from '@/types'
import { usePageTitle } from '@/lib/usePageTitle'

const typeFilters: { label: string; value: OpportunityType | 'ALL' }[] = [
  { label: 'Todas',    value: 'ALL' },
  { label: 'Pasantía', value: 'PASANTIA' },
  { label: 'Práctica', value: 'PRACTICA' },
  { label: 'Trabajo',  value: 'TRABAJO' },
  { label: 'Proyecto', value: 'PROYECTO' },
]

const specialtyOptions = [
  'Todas las especialidades',
  'Informática',
  'Redes',
  'Electrónica',
  'Mecánica',
  'Gastronomía',
  'Administración',
  'Construcción',
]

function OportunidadesContent() {
  const { isAuthenticated } = useAuthStore()
  const searchParams        = useSearchParams()
  const searchQuery         = (searchParams.get('q') ?? '').toLowerCase()

  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters (client-side over fetched data)
  const [typeFilter, setTypeFilter]     = useState<'ALL' | OpportunityType>('ALL')
  const [minMatch, setMinMatch]         = useState(0)
  const [onlyRemote, setOnlyRemote]     = useState(false)
  const [appliedIds, setAppliedIds]     = useState<Set<string>>(new Set())
  const [savedIds, setSavedIds]         = useState<Set<string>>(new Set())

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        if (isAuthenticated) {
          // Ofertas activas y mis postulaciones, en paralelo (contrato postulaciones.yaml)
          const [oppsArr, apps] = await Promise.all([
            listarOportunidades(),
            misPostulaciones().catch(() => []),
          ])
          const savedRes = { data: [] as Opportunity[] } // guardar ofertas: fase 2
          const alreadyApplied = new Set(apps.map(a => a.opportunityId))
          const alreadySaved   = new Set((savedRes?.data ?? []).map((o: Opportunity) => o.id))
          setAppliedIds(alreadyApplied)
          setSavedIds(alreadySaved)
          // Exclude already-applied opportunities from the list
          setOpportunities(oppsArr.filter(o => !alreadyApplied.has(o.id)))
        }
      } catch {
        setError('No se pudo conectar al servidor.')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [isAuthenticated])

  // Filtros en memoria (client-side)
  const filtered = opportunities.filter(opp => {
    if (typeFilter !== 'ALL' && opp.type !== typeFilter) return false
    if (onlyRemote && !opp.isRemote) return false
    if (minMatch > 0 && (opp.matchScore ?? 0) < minMatch) return false
    if (searchQuery) {
      const haystack = `${opp.title} ${opp.description} ${opp.location} ${(opp as any).company?.name ?? ''}`.toLowerCase()
      if (!haystack.includes(searchQuery)) return false
    }
    return true
  })

  const handleApply = async (id: string) => {
    if (!isAuthenticated || appliedIds.has(id)) return
    // Optimistic: mark as applied AND remove from visible list immediately
    setAppliedIds(prev => new Set(Array.from(prev).concat(id)))
    setOpportunities(prev => prev.filter(o => o.id !== id))
    try {
      await postular(id)
    } catch (e: any) {
      // 409 = ya habias postulado: el backend no duplica nada, la dejamos marcada
      if (e?.response?.status === 409) return
      // Otro error: deshacer y volver a mostrar la oferta
      setAppliedIds(prev => { const n = new Set(prev); n.delete(id); return n })
      listarOportunidades()
        .then(arr => {
          const restored = arr.find(o => o.id === id)
          if (restored) setOpportunities(prev => [restored, ...prev])
        })
        .catch(() => {})
      setError('No se pudo enviar la postulación. Intenta de nuevo.')
    }
  }

  const handleSave = async (id: string) => {
    // Optimistic update
    setSavedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
    try {
      await api.post(`/opportunities/${id}/save`, {})
    } catch {
      // Revert on failure
      setSavedIds(prev => {
        const next = new Set(prev)
        next.has(id) ? next.delete(id) : next.add(id)
        return next
      })
    }
  }

  const highMatchCount = filtered.filter(o => (o.matchScore ?? 0) >= 70).length

  return (
    <main className="max-w-[1440px] mx-auto px-8 py-10">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">

        {/* ── Sidebar de filtros ──────────────────────────────────────── */}
        <aside className="md:col-span-3 space-y-6">
          <div className="card p-6">
            <h2 className="font-headline font-bold text-[11px] uppercase tracking-widest text-outline mb-5">
              Filtros
            </h2>

            {/* Tipo */}
            <div className="mb-6">
              <p className="text-[11px] font-bold uppercase tracking-widest text-outline mb-3">Tipo</p>
              <div className="flex flex-wrap gap-2">
                {typeFilters.map(({ label, value }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTypeFilter(value)}
                    aria-pressed={typeFilter === value}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                      typeFilter === value
                        ? 'bg-primary-container text-on-primary'
                        : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Solo remotas */}
            <div className="mb-6 flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={onlyRemote}
                aria-label="Solo remotas"
                onClick={() => setOnlyRemote(v => !v)}
                className={`w-10 h-6 rounded-full relative transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${onlyRemote ? 'bg-primary-container' : 'bg-surface-container-high'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${onlyRemote ? 'right-1' : 'left-1'}`} aria-hidden="true" />
              </button>
              <span className="text-sm font-semibold text-on-surface">Solo remotas</span>
            </div>

            {/* Match mínimo */}
            {isAuthenticated && (
              <div>
                <label htmlFor="min-match" className="text-[11px] font-bold uppercase tracking-widest text-outline mb-3 block">Match mínimo</label>
                <div className="flex items-center gap-3">
                  <input
                    id="min-match"
                    type="range" min="0" max="100" step="10"
                    value={minMatch}
                    onChange={e => setMinMatch(Number(e.target.value))}
                    className="flex-1 accent-primary"
                  />
                  <span className="text-sm font-bold text-primary w-10 text-right">{minMatch}%</span>
                </div>
              </div>
            )}
          </div>

          {/* Resumen de match */}
          {isAuthenticated && opportunities.length > 0 && (
            <div className="card p-5 bg-primary-fixed/40">
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-primary text-[20px] icon-filled" aria-hidden="true">auto_awesome</span>
                <h3 className="font-headline font-bold text-sm text-on-surface">Tu perfil es compatible</h3>
              </div>
              <p className="text-xs text-on-surface-variant leading-relaxed mb-3">
                Basado en tus habilidades, tienes alta compatibilidad con {highMatchCount} oportunidades activas.
              </p>
              <div className="text-2xl font-extrabold text-primary font-headline">
                {highMatchCount}
                <span className="text-sm font-semibold text-on-surface-variant ml-1">
                  de {opportunities.length}
                </span>
              </div>
            </div>
          )}

          {/* Consejos */}
          <div className="card p-5 bg-[#fff8e1] border border-[#ffecb3]">
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-amber-600 text-[20px] icon-filled" aria-hidden="true">lightbulb</span>
              <h3 className="font-headline font-bold text-sm text-amber-900">Consejos para Entrevistas</h3>
            </div>
            <ul className="text-xs text-amber-800/80 space-y-2 list-disc pl-4">
              <li><strong>Investiga la empresa:</strong> Conoce su cultura y proyectos recientes.</li>
              <li><strong>Sé puntual:</strong> Conéctate o llega 5 minutos antes.</li>
              <li><strong>Prepara preguntas:</strong> Demuestra interés en el rol.</li>
              <li><strong>Menciona tus logros:</strong> No temas hablar de proyectos escolares o personales.</li>
            </ul>
          </div>
        </aside>

        {/* ── Resultados ──────────────────────────────────────────────── */}
        <section className="md:col-span-9">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="font-headline text-2xl font-bold text-on-surface">
                {isAuthenticated ? 'Oportunidades para ti' : 'Oportunidades disponibles'}
              </h1>
              <p className="text-sm text-on-surface-variant mt-0.5">
                {loading ? 'Cargando...' : `${filtered.length} oportunidades disponibles`}
              </p>
            </div>
          </div>

          {/* Aviso de error no crítico */}
          {error && (
            <div role="alert" className="mb-4 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
              <span className="material-symbols-outlined text-[14px]" aria-hidden="true">info</span>
              {error}
            </div>
          )}

          {/* Banner de alta compatibilidad */}
          {isAuthenticated && filtered[0]?.matchScore && filtered[0].matchScore >= 80 && (
            <div className="mb-6 p-4 rounded-xl bg-primary-fixed/30 border border-primary/15 flex items-center gap-4">
              <div className="w-10 h-10 editorial-gradient rounded-lg flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-on-primary text-[20px] icon-filled">auto_awesome</span>
              </div>
              <div>
                <p className="text-sm font-bold text-on-surface">Alta compatibilidad detectada</p>
                <p className="text-xs text-on-surface-variant">
                  Tienes oportunidades con más del 80% de match. Haz clic en el badge de match para ver el desglose.
                </p>
              </div>
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="card p-6 animate-pulse">
                  <div className="flex gap-4 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-surface-container-high" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-surface-container-high rounded w-3/4" />
                      <div className="h-3 bg-surface-container-high rounded w-1/2" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 bg-surface-container-high rounded w-full" />
                    <div className="h-3 bg-surface-container-high rounded w-5/6" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Lista de oportunidades */}
          {!loading && (
            <div className="space-y-4">
              {filtered.map((opp) => (
                <OpportunityCard
                  key={opp.id}
                  opportunity={opp}
                  onApply={handleApply}
                  onSave={handleSave}
                  applied={appliedIds.has(opp.id)}
                  saved={savedIds.has(opp.id)}
                />
              ))}

              {filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <span className="material-symbols-outlined text-[64px] text-outline">search_off</span>
                  <h2 className="font-headline text-xl font-bold text-on-surface mt-4">
                    No hay resultados
                  </h2>
                  <p className="text-on-surface-variant text-sm mt-2">
                    Intenta cambiar los filtros o reducir el match mínimo.
                  </p>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

export default function OportunidadesPage() {
  usePageTitle('Oportunidades')
  return (
    <Suspense fallback={<div />}>
      <OportunidadesContent />
    </Suspense>
  )
}
