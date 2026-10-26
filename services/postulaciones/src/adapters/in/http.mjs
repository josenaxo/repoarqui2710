// Adaptador de entrada: traduce cada ruta HTTP a su caso de uso y el resultado a una respuesta.
import { randomUUID } from 'node:crypto'
import { ErrorDominio } from '../../domain/errores.mjs'
import * as casos from '../../application/postulaciones.mjs'
import { repositorioPostulacionesDynamo } from '../out/dynamoRepositorioPostulaciones.mjs'
import { publicadorEventosSqs } from '../out/sqsPublicadorEventos.mjs'

// El HTTP API entrega los grupos como texto ("[empresa]"); se limpian y se toma el primero.
function leerActor(event) {
  const claims = event.requestContext?.authorizer?.jwt?.claims
  if (!claims?.sub) return null
  const grupos = String(claims['cognito:groups'] ?? '').replace(/[[\]"]/g, '').split(/[\s,]+/).filter(Boolean)
  return { id: claims.sub, grupo: grupos[0] }
}

function leerBody(event) {
  if (!event.body) return {}
  const texto = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body
  try {
    return JSON.parse(texto)
  } catch {
    throw new ErrorDominio(400, 'el cuerpo no es JSON válido')
  }
}

const respuesta = (statusCode, body) => ({
  statusCode,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

// Recibe las dependencias para poder probar el handler con dobles (test/http.test.mjs).
export function crearHandler(deps) {
  return async function manejar(event) {
    try {
      const actor = leerActor(event)
      const oportunidadId = event.pathParameters?.id
      switch (event.routeKey) {
        case 'POST /oportunidades':
          return respuesta(201, await casos.publicarOportunidad(deps, { actor, datos: leerBody(event) }))
        case 'GET /oportunidades':
          return respuesta(200, await casos.listarOportunidades(deps, { actor }))
        case 'GET /oportunidades/mias':
          return respuesta(200, await casos.misOportunidades(deps, { actor }))
        case 'POST /oportunidades/{id}/postulaciones':
          return respuesta(201, await casos.postular(deps, { actor, oportunidadId }))
        case 'GET /oportunidades/{id}/postulaciones':
          return respuesta(200, await casos.listarPostulantes(deps, { actor, oportunidadId }))
        case 'GET /postulaciones/mias':
          return respuesta(200, await casos.misPostulaciones(deps, { actor }))
        default:
          return respuesta(404, { mensaje: 'ruta no encontrada' })
      }
    } catch (error) {
      if (error instanceof ErrorDominio) return respuesta(error.estado, { mensaje: error.message })
      console.error(JSON.stringify({ nivel: 'error', ruta: event.routeKey, mensaje: String(error) }))
      return respuesta(500, { mensaje: 'Error interno' })
    }
  }
}

// La raíz de composición: aquí se conectan los adaptadores reales.
export const handler = crearHandler({
  repositorio: repositorioPostulacionesDynamo,
  publicador: publicadorEventosSqs,
  generarId: randomUUID,
  reloj: () => new Date().toISOString(),
})