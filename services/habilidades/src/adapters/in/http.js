import { crearServicioHabilidades } from '../../application/servicioHabilidades.js'
import { repositorioHabilidadesDynamo } from '../out/dynamoRepositorioHabilidades.js'
import { publicadorEventosSqs } from '../out/sqsPublicadorEventos.js'
import { crearLectorPerfilesHttp } from '../out/httpLectorPerfiles.js'

const ESTADOS_ESPERADOS = new Set([400, 401, 403, 404, 409])

function leerGrupos(valor) {
  if (Array.isArray(valor)) return valor
  if (typeof valor !== 'string') return []
  return valor.replace(/[\[\]"]/g, '').split(/[\s,]+/).filter(Boolean)
}

function leerActor(event) {
  const claims = event.requestContext?.authorizer?.jwt?.claims
  if (!claims?.sub) return null
  const authorization = event.headers?.authorization ?? event.headers?.Authorization ?? ''
  return {
    id: claims.sub,
    rol: leerGrupos(claims['cognito:groups'])[0],
    token: authorization.replace(/^Bearer\s+/i, ''),
  }
}

class BodyInvalido extends Error {}

function leerBody(event) {
  if (!event.body) return {}
  const texto = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body
  try {
    return JSON.parse(texto)
  } catch {
    throw new BodyInvalido()
  }
}

function respuesta(statusCode, body) {
  return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
}

export function crearHandler({ repositorio, eventos, perfiles }) {
  const servicio = crearServicioHabilidades(repositorio, eventos, perfiles)

  return async function manejar(event) {
    try {
      const usuario = leerActor(event)
      const body = leerBody(event)
      switch (event.routeKey) {
        case 'POST /habilidades': return respuesta(201, await servicio.declarar(usuario, body))
        case 'GET /habilidades/me': return respuesta(200, await servicio.listarPropias(usuario))
        case 'GET /habilidades/pendientes': return respuesta(200, await servicio.listarPendientes(usuario))
        case 'PATCH /habilidades/{estudianteId}/{habilidadId}':
          return respuesta(200, await servicio.revisar(usuario, event.pathParameters?.estudianteId, event.pathParameters?.habilidadId, body))
        default: return respuesta(404, { mensaje: 'Ruta no encontrada' })
      }
    } catch (error) {
      if (error instanceof BodyInvalido) return respuesta(400, { mensaje: 'El cuerpo no es un JSON valido' })
      if (ESTADOS_ESPERADOS.has(error?.statusCode)) return respuesta(error.statusCode, { mensaje: error.message })
      console.error(JSON.stringify({ nivel: 'error', ruta: event.routeKey, mensaje: error?.message, stack: error?.stack }))
      return respuesta(500, { mensaje: 'Error interno' })
    }
  }
}

let manejador
export async function handler(event) {
  manejador ??= crearHandler({
    repositorio: repositorioHabilidadesDynamo,
    eventos: publicadorEventosSqs,
    perfiles: crearLectorPerfilesHttp(),
  })
  return manejador(event)
}
