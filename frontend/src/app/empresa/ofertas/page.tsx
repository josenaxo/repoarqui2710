'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { listarPostulantes, misOportunidades, publicarOportunidad } from '@/lib/api/postulaciones'
import { useAuthStore } from '@/store/auth.store'
import { Button } from '@/components/ui/Button'
import { cn, timeAgo } from '@/lib/utils'
import type { Opportunity, OpportunityType } from '@/types'
import { usePageTitle } from '@/lib/usePageTitle'

const typeLabel: Record<string, string> = {
  PASANTIA: 'Pasantía', PRACTICA: 'Práctica', TRABAJO: 'Trabajo', PROYECTO: 'Proyecto',
}

interface OfferForm {
  title: string
  location: string
  type: OpportunityType
  description: string
  skills: string
  salary: string
  isRemote: boolean
  deadline: string
}

const emptyForm: OfferForm = {
  title: '', location: '', type: 'PASANTIA',
  description: '', skills: '', salary: '',
  isRemote: false, deadline: '',
}

export default function GestionOfertasPage() {
  usePageTitle('Gestión de ofertas')
  const { isAuthenticated } = useAuthStore()
  const [offers, setOffers]     = useState<Opportunity[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState<OfferForm>(emptyForm)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)

  // Cargar ofertas de la empresa con conteo real de postulantes
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        if (isAuthenticated) {
          const offers = await misOportunidades()
          // Postulantes de cada oferta, en paralelo (una llamada por oferta)
          const listas = await Promise.all(
            offers.map(o => listarPostulantes(o.id).catch(() => [])),
          )
          const applicants = listas.flat()
          // Recalculate applicantsCount from real applicant data
          const countByOpp: Record<string, number> = {}
          if (Array.isArray(applicants)) {
            for (const a of applicants) {
              if (a.opportunityId) countByOpp[a.opportunityId] = (countByOpp[a.opportunityId] ?? 0) + 1
            }
          }
          const synced = offers.map(o => ({
            ...o,
            applicantsCount: countByOpp[o.id] ?? o.applicantsCount,
          }))
          setOffers(synced)
        }
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [isAuthenticated])

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.location.trim() || !form.description.trim()) {
      setError('El título, la ubicación y la descripción son obligatorios.')
      return
    }
    setSaving(true)
    setError(null)

    // Solo los campos de NuevaOportunidad (contrato): el backend rechaza campos extra
    const payload = {
      titulo:      form.title.trim(),
      descripcion: form.description.trim(),
      tipo:        form.type,
      ubicacion:   form.location.trim(),
      remoto:      form.isRemote,
    }

    try {
      if (isAuthenticated) {
        const created = await publicarOportunidad(payload)
        setOffers(prev => [created, ...prev])
      }
      setForm(emptyForm)
      setShowForm(false)
    } catch (err: any) {
      setError(err?.response?.data?.mensaje ?? 'Error al publicar la oferta.')
    } finally {
      setSaving(false)
    }
  }

  // Pausar y borrar ofertas: fase 2 (no están en contracts/api/postulaciones.yaml)
  const toggleActive = async (_id: string) => {
    alert('Pausar ofertas estará disponible pronto.')
  }

  const handleDelete = async (_id: string) => {
    alert('Eliminar ofertas estará disponible pronto.')
  }

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-headline text-3xl font-bold text-on-surface">Gestión de Ofertas</h1>
          <p className="text-on-surface-variant mt-1">
            {loading ? 'Cargando...' : `${offers.filter(o => o.isActive).length} activas · ${offers.length} en total`}
          </p>
        </div>
        <Button onClick={() => setShowForm(v => !v)} icon={showForm ? 'close' : 'add'}>
          {showForm ? 'Cancelar' : 'Nueva oferta'}
        </Button>
      </div>

      {/* ── Formulario nueva oferta ────────────────────────────────────── */}
      {showForm && (
        <div className="card p-8 mb-8 animate-fade-in">
          <h2 className="font-headline text-xl font-bold text-on-surface mb-6">Crear nueva oferta</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label htmlFor="offer-title" className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">Título del cargo *</label>
              <input
                id="offer-title"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Ej: Pasantía Desarrollador Frontend"
                aria-required="true"
                className="w-full bg-surface-container-low rounded-lg px-4 py-2.5 text-sm outline-none border border-transparent focus:border-primary focus-visible:ring-2 focus-visible:ring-primary transition-colors"
              />
            </div>

            <div>
              <label htmlFor="offer-location" className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">Ubicación *</label>
              <input
                id="offer-location"
                value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                placeholder="Ej: Santiago, Chile"
                aria-required="true"
                className="w-full bg-surface-container-low rounded-lg px-4 py-2.5 text-sm outline-none border border-transparent focus:border-primary focus-visible:ring-2 focus-visible:ring-primary transition-colors"
              />
            </div>

            <div>
              <label htmlFor="offer-type" className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">Tipo</label>
              <select
                id="offer-type"
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value as OpportunityType }))}
                className="w-full bg-surface-container-low rounded-lg px-4 py-2.5 text-sm outline-none border border-transparent focus:border-primary focus-visible:ring-2 focus-visible:ring-primary"
              >
                {Object.entries(typeLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>

            <div>
              <label htmlFor="offer-deadline" className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">Fecha límite</label>
              <input
                id="offer-deadline"
                type="date"
                value={form.deadline}
                onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
                className="w-full bg-surface-container-low rounded-lg px-4 py-2.5 text-sm outline-none border border-transparent focus:border-primary focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>

            <div>
              <label htmlFor="offer-salary" className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">Renta / Estipendio</label>
              <input
                id="offer-salary"
                value={form.salary}
                onChange={e => setForm(f => ({ ...f, salary: e.target.value }))}
                placeholder="Ej: $450.000 - $600.000 CLP"
                className="w-full bg-surface-container-low rounded-lg px-4 py-2.5 text-sm outline-none border border-transparent focus:border-primary focus-visible:ring-2 focus-visible:ring-primary transition-colors"
              />
            </div>

            <div className="flex items-center gap-3 self-end pb-2">
              <button
                type="button"
                role="switch"
                aria-checked={form.isRemote}
                aria-label="Modalidad remota"
                onClick={() => setForm(f => ({ ...f, isRemote: !f.isRemote }))}
                className={`w-10 h-6 rounded-full relative transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${form.isRemote ? 'bg-primary-container' : 'bg-surface-container-high'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${form.isRemote ? 'right-1' : 'left-1'}`} aria-hidden="true" />
              </button>
              <span className="text-sm font-semibold text-on-surface">Modalidad remota</span>
            </div>

            <div className="md:col-span-2">
              <label htmlFor="offer-description" className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">Descripción *</label>
              <textarea
                id="offer-description"
                rows={4}
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Describe la oportunidad, lo que aprenderá el estudiante y el ambiente de trabajo..."
                aria-required="true"
                className="w-full bg-surface-container-low rounded-lg px-4 py-3 text-sm outline-none border border-transparent focus:border-primary focus-visible:ring-2 focus-visible:ring-primary resize-none transition-colors"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="offer-skills" className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">Habilidades requeridas</label>
              <input
                id="offer-skills"
                value={form.skills}
                onChange={e => setForm(f => ({ ...f, skills: e.target.value }))}
                placeholder="React, Node.js, SQL, Trabajo en equipo (separadas por coma)"
                aria-describedby="offer-skills-hint"
                className="w-full bg-surface-container-low rounded-lg px-4 py-2.5 text-sm outline-none border border-transparent focus:border-primary focus-visible:ring-2 focus-visible:ring-primary transition-colors"
              />
              <p id="offer-skills-hint" className="text-[11px] text-on-surface-variant mt-1.5">
                Estas habilidades se usan para calcular el match con los estudiantes.
              </p>
            </div>
          </div>

          {error && (
            <p role="alert" className="mt-4 text-sm text-error font-semibold">{error}</p>
          )}

          <div className="flex items-center gap-3 mt-6 justify-end">
            <Button variant="secondary" onClick={() => { setShowForm(false); setForm(emptyForm); setError(null) }}>
              Cancelar
            </Button>
            <Button icon="publish" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Publicando...' : 'Publicar oferta'}
            </Button>
          </div>
        </div>
      )}

      {/* ── Lista de ofertas ───────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="card p-6 animate-pulse h-32 bg-surface-container-low" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {offers.map((offer) => (
            <OfferRow
              key={offer.id}
              offer={offer}
              onToggle={toggleActive}
              onDelete={handleDelete}
            />
          ))}
          {offers.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <span className="material-symbols-outlined text-[64px] text-outline">work_off</span>
              <h2 className="font-headline text-xl font-bold text-on-surface mt-4">Sin ofertas publicadas</h2>
              <p className="text-on-surface-variant text-sm mt-2">Publica tu primera oferta para empezar a recibir postulantes.</p>
              <Button className="mt-6" icon="add" onClick={() => setShowForm(true)}>
                Crear primera oferta
              </Button>
            </div>
          )}
        </div>
      )}
    </main>
  )
}

// ── Fila de oferta ────────────────────────────────────────────────────────────

function OfferRow({
  offer, onToggle, onDelete,
}: {
  offer: Opportunity
  onToggle: (id: string) => void
  onDelete: (id: string) => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <article className={cn('card p-6 transition-opacity', !offer.isActive && 'opacity-60')}>
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h3 className="font-headline font-bold text-on-surface">{offer.title}</h3>
                <span className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant">
                  {typeLabel[offer.type]}
                </span>
                <span className={cn(
                  'text-[10px] font-bold px-2.5 py-0.5 rounded-full',
                  offer.isActive ? 'bg-green-50 text-green-700' : 'bg-surface-container text-outline',
                )}>
                  {offer.isActive ? '● Activa' : '○ Inactiva'}
                </span>
              </div>
              <p className="text-sm text-on-surface-variant">
                {offer.location}{offer.isRemote && ' · Remoto'}
                {offer.salary && ` · ${offer.salary}`}
              </p>
              {offer.deadline && (
                <p className="text-xs text-outline mt-0.5">
                  Fecha límite: {new Date(offer.deadline).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onToggle(offer.id)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                  offer.isActive
                    ? 'bg-surface-container text-on-surface-variant hover:bg-error-container hover:text-error'
                    : 'bg-primary-fixed text-primary-container hover:bg-primary-container hover:text-on-primary',
                )}
              >
                {offer.isActive ? 'Pausar' : 'Activar'}
              </button>

              {confirmDelete ? (
                <>
                  <button
                    type="button"
                    onClick={() => { onDelete(offer.id); setConfirmDelete(false) }}
                    aria-label={`Confirmar eliminación de ${offer.title}`}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-error text-on-error hover:opacity-90 transition-all"
                  >
                    Confirmar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    aria-label="Cancelar eliminación"
                    className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container transition-all"
                  >
                    <span className="material-symbols-outlined text-[16px]" aria-hidden="true">close</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  aria-label={`Eliminar oferta ${offer.title}`}
                  className="p-1.5 rounded-lg text-outline hover:text-error hover:bg-error-container transition-all"
                >
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">delete</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 mt-3">
            {offer.skills?.map(s => (
              <span key={s} className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-surface-container-low text-on-surface-variant border border-outline-variant/20">
                {s}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-4 mt-4 pt-3 border-t border-outline-variant/10 text-xs text-outline">
            <span className="flex items-center gap-1 font-semibold text-on-surface-variant">
              <span className="material-symbols-outlined text-[14px]">group</span>
              {offer.applicantsCount} postulantes
            </span>
            <span>Publicada {timeAgo(offer.createdAt)}</span>
            <Link className="ml-auto text-primary font-semibold hover:underline" href={`/empresa/postulantes?oferta=${offer.id}`}>
              Ver postulantes →
            </Link>
          </div>
        </div>
      </div>
    </article>
  )
}
