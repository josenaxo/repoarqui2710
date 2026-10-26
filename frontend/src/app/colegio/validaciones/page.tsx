'use client'

import { useState, useEffect } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { SkillPill } from '@/components/ui/SkillPill'
import {
  listarHabilidadesPendientes,
  mensajeDeErrorHabilidades,
  revisarHabilidad,
  type HabilidadPendiente,
} from '@/lib/api/habilidades'
import { useAuthStore } from '@/store/auth.store'
import type { StudentProfile } from '@/types'
import { usePageTitle } from '@/lib/usePageTitle'

type ValidationAction = 'VALIDADA' | 'RECHAZADA' | null

// Group skills by student
function groupByStudent(skills: HabilidadPendiente[]): Map<string, { student: StudentProfile; skills: HabilidadPendiente[] }> {
  const map = new Map<string, { student: StudentProfile; skills: HabilidadPendiente[] }>()
  for (const skill of skills) {
    const sid = skill.student.id
    if (!map.has(sid)) map.set(sid, { student: skill.student, skills: [] })
    map.get(sid)!.skills.push(skill)
  }
  return map
}

export default function ValidacionesPage() {
  usePageTitle('Validaciones y sugerencias')
  const { isAuthenticated } = useAuthStore()
  const [pendingSkills, setPendingSkills] = useState<HabilidadPendiente[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (isAuthenticated) {
      listarHabilidadesPendientes()
        .then(data => setPendingSkills(data))
        .catch(err => setLoadError(mensajeDeErrorHabilidades(err, 'No se pudieron cargar las validaciones.')))
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [isAuthenticated])

  const onSaved = (savedSkillIds: string[]) => {
    setPendingSkills(prev => prev.filter(sk => !savedSkillIds.includes(sk.id)))
  }

  const grouped = groupByStudent(pendingSkills)
  const totalPending = pendingSkills.length

  if (loading) {
    return (
      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="h-9 w-72 bg-surface-container rounded-lg animate-pulse mb-2" />
        <div className="h-4 w-48 bg-surface-container rounded animate-pulse mb-8" />
        {[1, 2].map(i => (
          <div key={i} className="card p-6 mb-6 animate-pulse">
            <div className="flex gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-surface-container-low" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-40 bg-surface-container rounded" />
                <div className="h-3 w-28 bg-surface-container-low rounded" />
              </div>
            </div>
            <div className="h-16 bg-surface-container-low rounded-xl" />
          </div>
        ))}
      </main>
    )
  }

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-headline text-3xl font-bold text-on-surface">Validaciones y Sugerencias</h1>
          <p className="text-on-surface-variant mt-1">
            {totalPending} habilidades pendientes de validación
          </p>
        </div>
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-4 py-2.5 rounded-xl">
          <span className="material-symbols-outlined text-amber-600 text-[18px] icon-filled">pending_actions</span>
          <span className="text-sm font-bold text-amber-700">
            {grouped.size} estudiantes esperan validación
          </span>
        </div>
      </div>

      {loadError && <p className="mb-4 text-sm text-error font-semibold">{loadError}</p>}

      <div className="space-y-6">
        {Array.from(grouped.values()).map(({ student, skills }) => (
          <StudentValidationCard
            key={student.id}
            student={student}
            pendingSkills={skills}
            onSaved={onSaved}
          />
        ))}
      </div>

      {totalPending === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <span className="material-symbols-outlined text-[64px] text-green-400">task_alt</span>
          <h2 className="font-headline text-xl font-bold text-on-surface mt-4">¡Todo al día!</h2>
          <p className="text-on-surface-variant text-sm mt-2">No hay habilidades pendientes de validación.</p>
        </div>
      )}
    </main>
  )
}

function StudentValidationCard({
  student,
  pendingSkills,
  onSaved,
}: {
  student: StudentProfile
  pendingSkills: HabilidadPendiente[]
  onSaved: (ids: string[]) => void
}) {
  const { isAuthenticated } = useAuthStore()
  const fullName = `${student.firstName} ${student.lastName}`
  const [actions, setActions] = useState<Record<string, ValidationAction>>({})
  const [notes, setNotes]     = useState<Record<string, string>>({})
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const setAction = (skillId: string, action: ValidationAction) =>
    setActions(prev => ({ ...prev, [skillId]: action }))

  const approveAll = () => {
    const next: Record<string, ValidationAction> = {}
    for (const sk of pendingSkills) next[sk.id] = 'VALIDADA'
    setActions(next)
  }

  const save = async () => {
    const toProcess = Object.entries(actions).filter(([, v]) => v !== null)
    if (toProcess.length === 0) return

    setSaving(true)
    setError(null)
    const savedIds: string[] = []

    try {
      for (const [skillId, status] of toProcess) {
        if (!status) continue
        if (isAuthenticated) {
          await revisarHabilidad(student.id, skillId, {
            estado: status === 'VALIDADA' ? 'validada' : 'rechazada',
            comentario: notes[skillId] || undefined,
          })
        }
        savedIds.push(skillId)
      }
      onSaved(savedIds)
    } catch (err: any) {
      setError(mensajeDeErrorHabilidades(err, 'Error al guardar las validaciones.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card p-6">
      {/* Student header */}
      <div className="flex items-center gap-4 mb-6 pb-5 border-b border-outline-variant/10">
        <Avatar src={student.avatar} name={fullName} size="lg" />
        <div className="flex-1">
          <h3 className="font-headline font-bold text-on-surface text-lg">{fullName}</h3>
          <p className="text-sm text-on-surface-variant">{student.specialty} · {student.year}° año</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-on-surface-variant">{pendingSkills.length} pendientes</span>
          <button
            onClick={approveAll}
            className="px-4 py-2 rounded-lg bg-primary-container text-on-primary text-sm font-bold hover:opacity-90 transition-opacity"
          >
            Aprobar todo
          </button>
        </div>
      </div>

      {/* Skills */}
      <div className="space-y-4">
        {pendingSkills.map((skill) => {
          const action = actions[skill.id]
          return (
            <div
              key={skill.id}
              className={`p-4 rounded-xl border transition-all ${
                action === 'VALIDADA'  ? 'bg-green-50 border-green-200' :
                action === 'RECHAZADA' ? 'bg-error-container/30 border-error/20' :
                'bg-surface-container-low border-transparent'
              }`}
            >
              <div className="flex items-start gap-4 flex-wrap">
                <SkillPill
                  skill={{
                    ...skill,
                    isValidated: action === 'VALIDADA',
                    validationStatus: action ?? 'PENDIENTE',
                  }}
                  showLevel
                />

                <div className="flex-1 min-w-0">
                  <p className="text-xs text-on-surface-variant">
                    Categoría: <strong>{skill.category === 'TECNICA' ? 'Técnica' : skill.category === 'BLANDA' ? 'Blanda' : 'Certificación'}</strong>
                    {' · '}Nivel declarado: <strong>{skill.level}/5</strong>
                    {' · '}{skill.endorsements} avales de compañeros
                  </p>
                  {action && (
                    <input
                      value={notes[skill.id] ?? ''}
                      onChange={e => setNotes(prev => ({ ...prev, [skill.id]: e.target.value }))}
                      placeholder="Agrega una nota o sugerencia (opcional)..."
                      className="mt-2 w-full bg-transparent text-xs outline-none border-b border-outline-variant pb-1 focus:border-primary transition-colors placeholder:text-outline"
                    />
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setAction(skill.id, action === 'VALIDADA' ? null : 'VALIDADA')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      action === 'VALIDADA'
                        ? 'bg-green-500 text-white'
                        : 'bg-green-50 text-green-700 hover:bg-green-100'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px]">check_circle</span>
                    Validar
                  </button>
                  <button
                    onClick={() => setAction(skill.id, action === 'RECHAZADA' ? null : 'RECHAZADA')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      action === 'RECHAZADA'
                        ? 'bg-error text-on-error'
                        : 'bg-surface-container text-on-surface-variant hover:bg-error-container hover:text-error'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px]">cancel</span>
                    Rechazar
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {error && <p className="mt-3 text-xs text-error font-semibold">{error}</p>}

      {Object.values(actions).some(v => v !== null) && (
        <div className="mt-5 flex items-center justify-between">
          <span className="text-xs text-on-surface-variant">
            {Object.values(actions).filter(v => v === 'VALIDADA').length} para validar
            {' · '}
            {Object.values(actions).filter(v => v === 'RECHAZADA').length} para rechazar
          </span>
          <button
            onClick={save}
            disabled={saving}
            className="px-6 py-2.5 rounded-lg editorial-gradient text-on-primary text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar validaciones'}
          </button>
        </div>
      )}
    </div>
  )
}
