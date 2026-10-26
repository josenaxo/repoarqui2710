'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { applicationStatusLabel, timeAgo } from '@/lib/utils'
import { misPostulaciones } from '@/lib/api/postulaciones'
import { useAuthStore } from '@/store/auth.store'
import type { Application } from '@/types'
import { usePageTitle } from '@/lib/usePageTitle'

const statusSteps = ['PENDIENTE', 'EN_REVISION', 'ENTREVISTA', 'ACEPTADO']

function PostulacionesContent() {
  const { isAuthenticated } = useAuthStore()
  const searchParams        = useSearchParams()
  const router              = useRouter()
  const searchQuery         = (searchParams.get('q') ?? '').toLowerCase()

  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading]           = useState(true)
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null)

  useEffect(() => {
    if (isAuthenticated) {
      misPostulaciones()
        .then(data => setApplications(data))
        .catch(() => {})
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [isAuthenticated])

  const withdraw = async (id: string) => {
    if (!confirm('¿Retirás tu postulación?')) return
    setWithdrawingId(id)
    try {
      // Retirar postulación: fase 2 (no está en contracts/api/postulaciones.yaml)
      alert('Retirar postulaciones estará disponible pronto.')
    } catch {
      // silencioso
    } finally {
      setWithdrawingId(null)
    }
  }

  const matches = (a: Application) => {
    if (!searchQuery) return true
    const haystack = `${a.opportunity?.title ?? ''} ${a.opportunity?.company?.name ?? ''}`.toLowerCase()
    return haystack.includes(searchQuery)
  }

  const accepted = applications.filter(a => a.status === 'ACEPTADO' && matches(a))
  const active   = applications.filter(a => !['ACEPTADO', 'RECHAZADO'].includes(a.status) && matches(a))
  const finished = applications.filter(a => a.status === 'RECHAZADO' && matches(a))

  if (loading) {
    return (
      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="h-9 w-64 bg-surface-container rounded-lg animate-pulse mb-2" />
        <div className="h-4 w-40 bg-surface-container rounded animate-pulse mb-8" />
        {[1, 2].map(i => (
          <div key={i} className="card p-6 mb-4 animate-pulse">
            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-xl bg-surface-container-low shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-48 bg-surface-container rounded" />
                <div className="h-3 w-32 bg-surface-container-low rounded" />
                <div className="h-3 w-24 bg-surface-container-low rounded" />
              </div>
            </div>
          </div>
        ))}
      </main>
    )
  }

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-headline text-3xl font-bold text-on-surface">Mis Postulaciones</h1>
          <p className="text-on-surface-variant mt-1">
            {searchQuery
              ? `${accepted.length + active.length + finished.length} resultados para "${searchQuery}"`
              : `${applications.length} postulaciones en total`}
          </p>
        </div>

        <div className="hidden md:flex items-center gap-6">
          {[
            { label: 'Aceptadas',   count: accepted.length, color: 'text-green-600' },
            { label: 'Activas',     count: active.length,   color: 'text-primary' },
            { label: 'Finalizadas', count: finished.length, color: 'text-outline' },
          ].map(({ label, count, color }) => (
            <div key={label} className="text-center">
              <div className={`text-2xl font-extrabold font-headline ${color}`}>{count}</div>
              <div className="text-xs text-outline uppercase tracking-wide">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Aceptadas — sección prominente */}
      {accepted.length > 0 && (
        <section className="mb-10">
          <h2 className="font-headline font-bold text-[11px] uppercase tracking-widest text-green-700 mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[14px] icon-filled">verified</span>
            Aceptado
          </h2>
          <div className="space-y-4">
            {accepted.map(app => (
              <article key={app.id} className="card p-6 border-2 border-green-200 bg-green-50/30">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-green-600 text-[22px] icon-filled">verified</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold text-green-700 uppercase tracking-wide mb-1">
                          ¡Fuiste aceptado en esta oportunidad!
                        </p>
                        <h3 className="font-headline font-bold text-on-surface">{app.opportunity.title}</h3>
                        <p className="text-sm text-on-surface-variant">{app.opportunity.company.name} · {app.opportunity.location}</p>
                      </div>
                      <span className="text-xs font-bold px-3 py-1 rounded-full bg-green-100 text-green-700 shrink-0">
                        Aceptado
                      </span>
                    </div>
                    {app.opportunity.company.userId && (
                      <button
                        onClick={() => router.push(`/student/mensajes?with=${app.opportunity.company.userId}`)}
                        className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-bold hover:opacity-90 transition-opacity"
                      >
                        <span className="material-symbols-outlined text-[16px]">mail</span>
                        Contactar empresa
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Active */}
      {active.length > 0 && (
        <section className="mb-10">
          <h2 className="font-headline font-bold text-[11px] uppercase tracking-widest text-outline mb-4">
            En proceso
          </h2>
          <div className="space-y-4">
            {active.map((app) => {
              const { label, color } = applicationStatusLabel(app.status)
              const stepIdx = statusSteps.indexOf(app.status)

              return (
                <article key={app.id} className="card p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-surface-container-low flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-primary text-[22px]">business</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-headline font-bold text-on-surface">
                            {app.opportunity.title}
                          </h3>
                          <p className="text-sm text-on-surface-variant">
                            {app.opportunity.company.name} · {app.opportunity.location}
                          </p>
                          <p className="text-xs text-outline mt-1">
                            Postulé {timeAgo(app.createdAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-xs font-bold px-3 py-1 rounded-full ${color}`}>
                            {label}
                          </span>
                          {['PENDIENTE', 'EN_REVISION'].includes(app.status) && (
                            <button
                              onClick={() => withdraw(app.id)}
                              disabled={withdrawingId === app.id}
                              className="text-xs text-outline hover:text-error transition-colors disabled:opacity-40 px-2 py-1 rounded hover:bg-error/10"
                            >
                              {withdrawingId === app.id ? '...' : 'Retirar'}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Progress pipeline */}
                      <div className="mt-5">
                        <div className="flex items-center gap-0">
                          {statusSteps.map((step, i) => {
                            const isDone    = i <= stepIdx
                            const isCurrent = i === stepIdx
                            const isLast    = i === statusSteps.length - 1
                            const { label: stepLabel } = applicationStatusLabel(step)

                            return (
                              <div key={step} className="flex items-center flex-1">
                                <div className="flex flex-col items-center flex-1">
                                  <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                                    isDone
                                      ? 'bg-primary-container text-on-primary'
                                      : 'bg-surface-container text-outline'
                                  } ${isCurrent ? 'ring-4 ring-primary/20' : ''}`}>
                                    {isDone ? (
                                      <span className="material-symbols-outlined text-[14px]">
                                        {isCurrent ? 'radio_button_checked' : 'check'}
                                      </span>
                                    ) : (
                                      <span className="w-2 h-2 rounded-full bg-outline-variant" />
                                    )}
                                  </div>
                                  <span className={`text-[10px] font-semibold mt-1.5 text-center leading-tight ${
                                    isDone ? 'text-primary' : 'text-outline'
                                  }`}>
                                    {stepLabel}
                                  </span>
                                </div>
                                {!isLast && (
                                  <div className={`h-0.5 flex-1 mx-1 -mt-4 transition-colors ${
                                    i < stepIdx ? 'bg-primary-container' : 'bg-surface-container-high'
                                  }`} />
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {app.status === 'ENTREVISTA' && (
                        <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-center gap-2">
                          <span className="material-symbols-outlined text-amber-600 text-[18px] icon-filled">event</span>
                          <p className="text-xs font-semibold text-amber-700">
                            Entrevista agendada — Revisa tu correo para confirmar la fecha.
                          </p>
                        </div>
                      )}

                      {app.coverLetter && (
                        <p className="mt-3 text-xs text-on-surface-variant italic line-clamp-2 bg-surface-container-low rounded-lg px-3 py-2">
                          &quot;{app.coverLetter}&quot;
                        </p>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      )}

      {/* Finished */}
      {finished.length > 0 && (
        <section>
          <h2 className="font-headline font-bold text-[11px] uppercase tracking-widest text-outline mb-4">
            Finalizadas
          </h2>
          <div className="space-y-3">
            {finished.map((app) => {
              const { label, color } = applicationStatusLabel(app.status)
              return (
                <article key={app.id} className="card p-5 opacity-70">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-outline text-[18px]">business</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-on-surface text-sm">{app.opportunity.title}</h3>
                      <p className="text-xs text-on-surface-variant">{app.opportunity.company.name}</p>
                    </div>
                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${color}`}>{label}</span>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      )}

      {applications.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <span className="material-symbols-outlined text-[64px] text-outline">assignment</span>
          <h2 className="font-headline text-xl font-bold text-on-surface mt-4">Sin postulaciones aún</h2>
          <p className="text-on-surface-variant text-sm mt-2">
            Explora las oportunidades y postula a las que mejor se ajusten a tu perfil.
          </p>
        </div>
      )}
    </main>
  )
}

export default function PostulacionesPage() {
  usePageTitle('Mis postulaciones')
  return (
    <Suspense fallback={<div />}>
      <PostulacionesContent />
    </Suspense>
  )
}
