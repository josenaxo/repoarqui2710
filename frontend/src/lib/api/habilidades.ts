import { api } from '@/lib/api-client'
import { aStudentProfile, listarEstudiantesColegio, obtenerPerfil } from '@/lib/api/perfiles'
import type { Skill, SkillCategory, StudentProfile, ValidationStatus } from '@/types'

export interface HabilidadApi {
  id: string
  nombre: string
  categoria?: SkillCategory
  nivel?: number
  estudianteId: string
  colegioId: string
  estado: 'declarada' | 'validada' | 'rechazada'
  creadaEn: string
  revisadaEn?: string
  comentario?: string
}

export interface HabilidadPendiente extends Skill {
  estudianteId: string
  student: StudentProfile
}

const estadoFrontend = (estado: HabilidadApi['estado']): ValidationStatus => ({
  declarada: 'PENDIENTE',
  validada: 'VALIDADA',
  rechazada: 'RECHAZADA',
})[estado] as ValidationStatus

export function aSkill(habilidad: HabilidadApi): Skill {
  return {
    id: habilidad.id,
    name: habilidad.nombre,
    category: habilidad.categoria ?? 'TECNICA',
    level: habilidad.nivel ?? 1,
    isValidated: habilidad.estado === 'validada',
    validationStatus: estadoFrontend(habilidad.estado),
    validatedAt: habilidad.revisadaEn,
    endorsements: 0,
    createdAt: habilidad.creadaEn,
  }
}

export const listarMisHabilidades = async () =>
  (await api.get<HabilidadApi[]>('/habilidades/me')).map(aSkill)

export const declararHabilidad = async (datos: { nombre: string; categoria: SkillCategory; nivel: number }) =>
  aSkill(await api.post<HabilidadApi>('/habilidades', datos))

export async function listarHabilidadesPendientes(): Promise<HabilidadPendiente[]> {
  const [perfilColegio, habilidades] = await Promise.all([
    obtenerPerfil(),
    api.get<HabilidadApi[]>('/habilidades/pendientes'),
  ])
  if (!perfilColegio.colegioId) throw new Error('El perfil del colegio no tiene colegioId')

  const { estudiantes } = await listarEstudiantesColegio(perfilColegio.colegioId)
  const porId = new Map(estudiantes.map((perfil) => [perfil.userId, aStudentProfile(perfil)]))

  return habilidades.map((habilidad) => ({
    ...aSkill(habilidad),
    estudianteId: habilidad.estudianteId,
    student: porId.get(habilidad.estudianteId) ?? aStudentProfile({
      userId: habilidad.estudianteId,
      tipo: 'estudiante',
      colegioId: habilidad.colegioId,
    }),
  }))
}

export const revisarHabilidad = (
  estudianteId: string,
  habilidadId: string,
  datos: { estado: 'validada' | 'rechazada'; comentario?: string },
) => api.patch<HabilidadApi>(
  `/habilidades/${encodeURIComponent(estudianteId)}/${encodeURIComponent(habilidadId)}`,
  datos,
)

export function mensajeDeErrorHabilidades(error: any, porDefecto: string) {
  return error?.response?.data?.mensaje ?? porDefecto
}
