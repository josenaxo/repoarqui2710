// Casos de uso del servicio postulaciones (CU-04 a CU-07, núcleo).
// Reciben sus dependencias como parámetro: repositorio, publicador, generarId y reloj.
// No conocen AWS ni HTTP.
import { ErrorDominio } from '../domain/errores.mjs'
import { crearOportunidad } from '../domain/Oportunidad.mjs'
import { crearPostulacion, eventoPostulacionCreada } from '../domain/Postulacion.mjs'

function exigirGrupo(actor, grupo) {
  if (!actor?.id) throw new ErrorDominio(403, 'falta el usuario del token')
  if (actor.grupo !== grupo) throw new ErrorDominio(403, `solo el grupo ${grupo} puede hacer esto`)
}

async function oportunidadExistente(repositorio, oportunidadId) {
  const oportunidad = await repositorio.obtenerOportunidad(oportunidadId)
  if (!oportunidad) throw new ErrorDominio(404, 'la oferta no existe')
  return oportunidad
}

export async function publicarOportunidad({ repositorio, generarId, reloj }, { actor, datos }) {
  exigirGrupo(actor, 'empresa')
  const oportunidad = crearOportunidad(datos, { id: generarId(), empresaId: actor.id, ahora: reloj() })
  await repositorio.guardarOportunidad(oportunidad)
  return oportunidad
}

export async function listarOportunidades({ repositorio }, { actor }) {
  if (!actor?.id) throw new ErrorDominio(403, 'falta el usuario del token')
  const todas = await repositorio.listarOportunidades()
  return todas.filter((oportunidad) => oportunidad.activa)
}

export async function misOportunidades({ repositorio }, { actor }) {
  exigirGrupo(actor, 'empresa')
  return repositorio.listarOportunidadesEmpresa(actor.id)
}

export async function postular({ repositorio, publicador, generarId, reloj }, { actor, oportunidadId }) {
  exigirGrupo(actor, 'estudiante')
  const oportunidad = await oportunidadExistente(repositorio, oportunidadId)
  const postulacion = crearPostulacion(oportunidad, actor.id, reloj())

  const creada = await repositorio.crearPostulacion(postulacion)
  if (!creada) throw new ErrorDominio(409, 'ya postulaste a esta oferta')

  try {
    await publicador.publicar(eventoPostulacionCreada(postulacion, { id: generarId(), fecha: reloj() }))
  } catch (error) {
    // La postulación ya quedó guardada: no se responde error al estudiante. El evento perdido
    // queda registrado; en la fase 2 se evita con el patrón Outbox.
    console.error(JSON.stringify({ nivel: 'error', mensaje: 'no se pudo publicar PostulacionCreada', error: String(error) }))
  }
  return postulacion
}

export async function misPostulaciones({ repositorio }, { actor }) {
  exigirGrupo(actor, 'estudiante')
  return repositorio.listarPostulacionesEstudiante(actor.id)
}

export async function listarPostulantes({ repositorio }, { actor, oportunidadId }) {
  exigirGrupo(actor, 'empresa')
  const oportunidad = await oportunidadExistente(repositorio, oportunidadId)
  if (oportunidad.empresaId !== actor.id) throw new ErrorDominio(403, 'la oferta es de otra empresa')
  return repositorio.listarPostulantes(oportunidadId)
}