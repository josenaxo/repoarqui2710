'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { SkillPill } from '@/components/ui/SkillPill'
import { Button } from '@/components/ui/Button'
import { aStudentProfile, obtenerPerfil } from '@/lib/api/perfiles'
import { declararHabilidad, listarMisHabilidades, mensajeDeErrorHabilidades } from '@/lib/api/habilidades'
import { useAuthStore } from '@/store/auth.store'
import { calculateReadinessScore } from '@/lib/utils'
import type { Skill, SkillCategory, StudentProfile } from '@/types'
import { usePageTitle } from '@/lib/usePageTitle'

const categoryConfig: Record<SkillCategory, { label: string; icon: string; color: string }> = {
  TECNICA:       { label: 'Técnicas',        icon: 'code',              color: 'text-primary' },
  BLANDA:        { label: 'Blandas',         icon: 'psychology',        color: 'text-amber-600' },
  CERTIFICACION: { label: 'Certificaciones', icon: 'workspace_premium', color: 'text-green-600' },
}

const suggestedSkills: { name: string; category: SkillCategory }[] = [
  { name: 'Python',            category: 'TECNICA' },
  { name: 'Docker',            category: 'TECNICA' },
  { name: 'AWS',               category: 'TECNICA' },
  { name: 'Git',               category: 'TECNICA' },
  { name: 'Figma',             category: 'TECNICA' },
  { name: 'SQL',               category: 'TECNICA' },
  { name: 'Linux',             category: 'TECNICA' },
  { name: 'Liderazgo',         category: 'BLANDA' },
  { name: 'Gestión del tiempo', category: 'BLANDA' },
  { name: 'Proactividad',      category: 'BLANDA' },
]

export default function HabilidadesPage() {
  usePageTitle('Mis habilidades')
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()

  const [profile, setProfile]           = useState<Partial<StudentProfile>>({})
  const [skills, setSkills]             = useState<Skill[]>([])
  const [newSkill, setNewSkill]         = useState('')
  const [selectedCategory, setSelectedCategory] = useState<SkillCategory>('TECNICA')
  const [selectedLevel, setSelectedLevel] = useState(1)
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState<string | null>(null)

  // Score calculado localmente para actualización inmediata
  const liveScore = useMemo(() =>
    calculateReadinessScore({ ...profile, skills }),
    [profile, skills]
  )

  useEffect(() => {
    if (!isAuthenticated) return
    Promise.all([obtenerPerfil(), listarMisHabilidades()])
      .then(([perfil, habilidades]) => {
        setProfile(aStudentProfile(perfil))
        setSkills(habilidades)
      })
      .catch(err => setError(mensajeDeErrorHabilidades(err, 'No se pudieron cargar las habilidades.')))
  }, [isAuthenticated])

  const addSkill = async () => {
    const name = newSkill.trim()
    if (!name) return

    // Evitar duplicados
    if (skills.some(s => s.name.toLowerCase() === name.toLowerCase())) {
      setError('Ya tienes esa habilidad en tu perfil.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      if (isAuthenticated) {
        const created = await declararHabilidad({
          nombre: name,
          categoria: selectedCategory,
          nivel: selectedLevel,
        })
        setSkills(prev => [...prev, created])
      } else {
        // Modo demo
        const demo: Skill = {
          id: `sk-demo-${Date.now()}`,
          name,
          category: selectedCategory,
          level: selectedLevel,
          isValidated: false,
          validationStatus: 'PENDIENTE',
          endorsements: 0,
          createdAt: new Date().toISOString(),
        }
        setSkills(prev => [...prev, demo])
      }
      setNewSkill('')
      setSelectedLevel(1)
    } catch (err: any) {
      setError(mensajeDeErrorHabilidades(err, 'Error al agregar la habilidad.'))
    } finally {
      setSaving(false)
    }
  }

  const grouped = (Object.entries(categoryConfig) as [SkillCategory, typeof categoryConfig[SkillCategory]][])
    .map(([cat, config]) => ({
      category: cat,
      config,
      skills: skills.filter(s => s.category === cat),
    }))

  const validatedCount = skills.filter(s => s.isValidated).length

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-on-surface-variant hover:text-primary mb-3 transition-colors">
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Volver
          </button>
          <h1 className="font-headline text-3xl font-bold text-on-surface">Mis Habilidades</h1>
          <p className="text-on-surface-variant mt-1">
            {validatedCount} validadas · {skills.length} en total
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm bg-surface-container px-4 py-2.5 rounded-xl">
            <span className="material-symbols-outlined text-primary text-[18px] icon-filled">speed</span>
            <span className="font-bold text-on-surface">{liveScore.total}%</span>
            <span className="text-on-surface-variant text-xs">empleabilidad</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-on-surface-variant bg-primary-fixed/40 px-4 py-2.5 rounded-xl">
            <span className="material-symbols-outlined text-primary text-[18px] icon-filled">verified</span>
              <span className="font-semibold text-on-surface">{validatedCount}/{skills.length}</span>
            <span>validadas</span>
          </div>
        </div>
      </div>

      {/* ── Formulario agregar habilidad ─────────────────────────────── */}
      <div className="card p-6 mb-8">
        <h2 className="font-headline font-bold text-on-surface mb-4">Agregar habilidad</h2>

        {/* Selector de categoría */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {(Object.entries(categoryConfig) as [SkillCategory, typeof categoryConfig[SkillCategory]][]).map(([cat, { label, icon }]) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                selectedCategory === cat
                  ? 'bg-primary-container text-on-primary'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{icon}</span>
              {label}
            </button>
          ))}
        </div>

        {/* Input + nivel + botón */}
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            value={newSkill}
            onChange={e => { setNewSkill(e.target.value); setError(null) }}
            onKeyDown={e => e.key === 'Enter' && addSkill()}
            placeholder="Nombre de la habilidad..."
            className="flex-1 bg-surface-container-low rounded-lg px-4 py-2.5 text-sm outline-none border border-transparent focus:border-primary transition-colors"
          />

          {/* Selector de nivel */}
          <div className="flex items-center gap-1.5 bg-surface-container-low rounded-lg px-3 shrink-0">
            <span className="text-xs text-outline font-semibold">Nivel</span>
            {[1,2,3,4,5].map(l => (
              <button
                key={l}
                onClick={() => setSelectedLevel(l)}
                className={`w-6 h-6 rounded text-xs font-bold transition-all ${
                  l <= selectedLevel ? 'bg-primary-container text-on-primary' : 'text-outline hover:text-on-surface'
                }`}
              >
                {l}
              </button>
            ))}
          </div>

          <Button onClick={addSkill} icon="add" disabled={!newSkill.trim() || saving}>
            {saving ? 'Guardando...' : 'Agregar'}
          </Button>
        </div>

        {error && <p className="mt-2 text-xs text-error font-semibold">{error}</p>}

        {/* Sugeridas */}
        <div className="mt-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-outline mb-2">Sugeridas</p>
          <div className="flex flex-wrap gap-2">
            {suggestedSkills
              .filter(s => !skills.find(sk => sk.name.toLowerCase() === s.name.toLowerCase()))
              .slice(0, 7)
              .map(({ name, category }) => (
                <button
                  key={name}
                  onClick={() => { setNewSkill(name); setSelectedCategory(category) }}
                  className="px-3 py-1 rounded-full text-xs font-semibold bg-surface-container text-on-surface-variant hover:bg-surface-container-high border border-outline-variant/20 transition-all"
                >
                  + {name}
                </button>
              ))}
          </div>
        </div>
      </div>

      {/* ── Grupos de habilidades ─────────────────────────────────────── */}
      <div className="space-y-6">
        {grouped.map(({ category, config, skills: catSkills }) => (
          <div key={category} className="card p-6">
            <div className="flex items-center gap-2 mb-5">
              <span className={`material-symbols-outlined text-[20px] icon-filled ${config.color}`}>{config.icon}</span>
              <h2 className="font-headline font-bold text-on-surface">{config.label}</h2>
              <span className="text-xs text-outline ml-auto">{catSkills.length} habilidades</span>
            </div>

            {catSkills.length === 0 ? (
              <p className="text-sm text-outline py-4">No tienes habilidades en esta categoría.</p>
            ) : (
              <div className="space-y-3">
                {catSkills.map((skill) => (
                  <div key={skill.id} className="flex items-center gap-3 p-3 rounded-lg bg-surface-container-low group">
                    <SkillPill skill={skill} showLevel />
                    <div className="flex-1" />

                    {/* Barras de nivel */}
                    <div className="hidden sm:flex items-center gap-2">
                      <span className="text-[10px] text-outline">Nivel</span>
                      <div className="flex items-center gap-0.5">
                        {[1,2,3,4,5].map(l => (
                          <div key={l}
                            className={`w-4 h-1.5 rounded-full ${l <= (skill.level ?? 0) ? 'bg-primary-container' : 'bg-surface-container-high'}`}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Estado de validación */}
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                      skill.isValidated
                        ? 'bg-green-50 text-green-700'
                        : skill.validationStatus === 'PENDIENTE'
                          ? 'bg-amber-50 text-amber-600'
                          : 'bg-surface-container text-outline'
                    }`}>
                      {skill.isValidated
                        ? '✓ Validada'
                        : skill.validationStatus === 'PENDIENTE'
                          ? 'Pendiente'
                          : 'Sin validar'}
                    </span>

                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {skills.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <span className="material-symbols-outlined text-[64px] text-outline">psychology</span>
          <h2 className="font-headline text-xl font-bold text-on-surface mt-4">Aún no tienes habilidades</h2>
          <p className="text-on-surface-variant text-sm mt-2">
            Agrega tus primeras habilidades técnicas y blandas para mejorar tu índice de empleabilidad.
          </p>
        </div>
      )}
    </main>
  )
}
