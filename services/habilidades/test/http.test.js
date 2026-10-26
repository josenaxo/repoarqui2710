import test from 'node:test'
import assert from 'node:assert/strict'
import { crearHandler } from '../src/adapters/in/http.js'

function evento(routeKey, { body, claims, token = 'token-prueba', pathParameters } = {}) {
  return {
    routeKey,
    body: body === undefined ? undefined : body,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    pathParameters,
    requestContext: claims ? { authorizer: { jwt: { claims } } } : {},
  }
}

function dependencias() {
  return {
    repositorio: {
      async crear(habilidad) { return habilidad },
      async listarEstudiante() { return [] },
      async listarPendientes() { return [] },
      async obtener() { return null },
      async guardar(habilidad) { return habilidad },
    },
    eventos: { async publicar() {} },
    perfiles: { async obtenerPropio() { return { tipo: 'estudiante', colegioId: 'school-1' } } },
  }
}

const claimsEstudiante = { sub: 'e1', 'cognito:groups': '[estudiante]' }
const cuerpo = (respuesta) => JSON.parse(respuesta.body)

test('un body que no es JSON responde 400 sin filtrar el error del parser', async () => {
  const handler = crearHandler(dependencias())
  const respuesta = await handler(evento('POST /habilidades', { body: '{malo', claims: claimsEstudiante }))
  assert.equal(respuesta.statusCode, 400)
  assert.deepEqual(cuerpo(respuesta), { mensaje: 'El cuerpo no es un JSON valido' })
})

test('un error inesperado responde 500 con mensaje generico', async (t) => {
  const deps = dependencias()
  deps.repositorio.listarEstudiante = async () => { throw new Error('detalle secreto de DynamoDB') }
  const handler = crearHandler(deps)
  t.mock.method(console, 'error', () => {})
  const respuesta = await handler(evento('GET /habilidades/me', { claims: claimsEstudiante }))
  assert.equal(respuesta.statusCode, 500)
  assert.deepEqual(cuerpo(respuesta), { mensaje: 'Error interno' })
})

test('el token Authorization se reenvia al lector de perfiles', async () => {
  const deps = dependencias()
  let tokenRecibido
  deps.perfiles.obtenerPropio = async (token) => {
    tokenRecibido = token
    return { tipo: 'estudiante', colegioId: 'school-1' }
  }
  const handler = crearHandler(deps)
  const respuesta = await handler(evento('POST /habilidades', {
    body: JSON.stringify({ nombre: 'Docker', colegioId: 'school-falso' }),
    claims: claimsEstudiante,
    token: 'access-token-real',
  }))
  assert.equal(respuesta.statusCode, 201)
  assert.equal(tokenRecibido, 'access-token-real')
  assert.equal(cuerpo(respuesta).colegioId, 'school-1')
})
