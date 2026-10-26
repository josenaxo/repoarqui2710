import { randomUUID } from 'node:crypto'
import { declarar, decidirValidacion } from '../domain/HabilidadEstudiante.js'

function errorHttp(statusCode, mensaje) {
  return Object.assign(new Error(mensaje), { statusCode })
}

function exigirRol(actor, rol, mensaje) {
  if (!actor?.id || actor.rol !== rol) throw errorHttp(403, mensaje)
}

async function obtenerPerfilConColegio(perfiles, actor, tipo) {
  const perfil = await perfiles.obtenerPropio(actor.token)
  if (perfil?.tipo !== tipo) throw errorHttp(403, 'el perfil no corresponde al rol requerido')
  if (!perfil.colegioId) throw errorHttp(400, 'el perfil no tiene colegio asociado')
  return perfil
}

export function crearServicioHabilidades(repositorio, eventos, perfiles) {
  return {
    async declarar(actor, datos) {
      exigirRol(actor, 'estudiante', 'solo un estudiante puede declarar habilidades')
      const perfil = await obtenerPerfilConColegio(perfiles, actor, 'estudiante')
      return repositorio.crear(declarar({ ...datos, estudianteId: actor.id, colegioId: perfil.colegioId }))
    },
    async listarPropias(actor) {
      exigirRol(actor, 'estudiante', 'acceso denegado')
      return repositorio.listarEstudiante(actor.id)
    },
    async listarPendientes(actor) {
      exigirRol(actor, 'colegio', 'solo el colegio puede revisar')
      const perfil = await obtenerPerfilConColegio(perfiles, actor, 'colegio')
      return repositorio.listarPendientes(perfil.colegioId)
    },
    async revisar(actor, estudianteId, habilidadId, decision) {
      exigirRol(actor, 'colegio', 'solo el colegio puede revisar')
      const perfilColegio = await obtenerPerfilConColegio(perfiles, actor, 'colegio')
      const habilidad = await repositorio.obtener(estudianteId, habilidadId)
      if (!habilidad) throw errorHttp(404, 'habilidad no encontrada')
      if (habilidad.colegioId !== perfilColegio.colegioId) throw errorHttp(403, 'el estudiante pertenece a otro colegio')
      const guardada = await repositorio.guardar(decidirValidacion(habilidad, decision.estado, decision.comentario))
      if (guardada.estado === 'validada') {
        await eventos.publicar({
          tipo: 'HabilidadValidada', version: 1, id: randomUUID(), fecha: new Date().toISOString(),
          destinatarioId: estudianteId,
          datos: { estudianteId, habilidadId, nombre: guardada.nombre, colegioId: perfilColegio.colegioId },
        })
      }
      return guardada
    },
  }
}
