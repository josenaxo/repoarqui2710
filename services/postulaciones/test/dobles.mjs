// Dobles de prueba: cumplen los puertos, pero guardan todo en memoria (sin AWS).
export function repositorioEnMemoria() {
  const oportunidades = new Map()
  const postulaciones = new Map() // clave: "<oportunidadId>|<estudianteId>"
  const masNuevasPrimero = (a, b) => b.creadaEn.localeCompare(a.creadaEn)
  return {
    async guardarOportunidad(oportunidad) { oportunidades.set(oportunidad.id, { ...oportunidad }) },
    async obtenerOportunidad(id) { return oportunidades.get(id) ?? null },
    async listarOportunidades() { return [...oportunidades.values()].sort(masNuevasPrimero) },
    async listarOportunidadesEmpresa(empresaId) {
      return [...oportunidades.values()].filter((o) => o.empresaId === empresaId).sort(masNuevasPrimero)
    },
    async crearPostulacion(postulacion) {
      const clave = `${postulacion.oportunidadId}|${postulacion.estudianteId}`
      if (postulaciones.has(clave)) return false
      postulaciones.set(clave, { ...postulacion })
      return true
    },
    async listarPostulacionesEstudiante(estudianteId) {
      return [...postulaciones.values()].filter((p) => p.estudianteId === estudianteId).sort(masNuevasPrimero)
    },
    async listarPostulantes(oportunidadId) {
      return [...postulaciones.values()].filter((p) => p.oportunidadId === oportunidadId)
    },
  }
}

export function publicadorEnMemoria() {
  const eventos = []
  return { eventos, async publicar(evento) { eventos.push(evento) } }
}

// Reloj e Ids predecibles, para que las pruebas den siempre el mismo resultado.
export function dependencias() {
  let n = 0
  let segundo = 0
  return {
    repositorio: repositorioEnMemoria(),
    publicador: publicadorEnMemoria(),
    generarId: () => `id-${++n}`,
    reloj: () => `2026-10-26T12:00:${String(segundo++).padStart(2, '0')}.000Z`,
  }
}

export const EMPRESA = { id: 'empresa-1', grupo: 'empresa' }
export const OTRA_EMPRESA = { id: 'empresa-2', grupo: 'empresa' }
export const ESTUDIANTE = { id: 'estudiante-1', grupo: 'estudiante' }
export const OFERTA = { titulo: 'Práctica Desarrollador Junior', descripcion: 'Apoyo al equipo web', tipo: 'PRACTICA' }