// Pruebas del handler: rutas, códigos HTTP y lectura del token, con dobles (sin AWS).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { crearHandler } from '../src/adapters/in/http.mjs'
import { dependencias, OFERTA } from './dobles.mjs'

const evento = (routeKey, { sub, grupos, body, id } = {}) => ({
  routeKey,
  pathParameters: id ? { id } : undefined,
  body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  requestContext: sub ? { authorizer: { jwt: { claims: { sub, 'cognito:groups': grupos } } } } : {},
})

test('flujo completo: publicar 201, postular 201, repetir 409, ver postulantes 200', async () => {
  const manejar = crearHandler(dependencias())
  const pub = await manejar(evento('POST /oportunidades', { sub: 'emp', grupos: '[empresa]', body: OFERTA }))
  assert.equal(pub.statusCode, 201)
  const { id } = JSON.parse(pub.body)
  const post = await manejar(evento('POST /oportunidades/{id}/postulaciones', { sub: 'est', grupos: '[estudiante]', id }))
  assert.equal(post.statusCode, 201)
  const otra = await manejar(evento('POST /oportunidades/{id}/postulaciones', { sub: 'est', grupos: '[estudiante]', id }))
  assert.equal(otra.statusCode, 409)
  const lista = await manejar(evento('GET /oportunidades/{id}/postulaciones', { sub: 'emp', grupos: '[empresa]', id }))
  assert.equal(lista.statusCode, 200)
  assert.equal(JSON.parse(lista.body).length, 1)
})

test('400 si el cuerpo no es JSON', async () => {
  const r = await crearHandler(dependencias())(evento('POST /oportunidades', { sub: 'emp', grupos: '[empresa]', body: '{malo' }))
  assert.equal(r.statusCode, 400)
})

test('403 si no hay usuario en el token', async () => {
  const r = await crearHandler(dependencias())(evento('GET /oportunidades'))
  assert.equal(r.statusCode, 403)
})

test('500 sin detalles si algo falla por dentro', async () => {
  const deps = dependencias()
  deps.repositorio.listarOportunidades = async () => { throw new Error('detalle interno') }
  const original = console.error
  console.error = () => {}
  try {
    const r = await crearHandler(deps)(evento('GET /oportunidades', { sub: 'est', grupos: '[estudiante]' }))
    assert.equal(r.statusCode, 500)
    assert.deepEqual(JSON.parse(r.body), { mensaje: 'Error interno' })
  } finally {
    console.error = original
  }
})

test('toda respuesta trae X-App-Version con la versión de la Lambda, también los errores', async () => {
  process.env.AWS_LAMBDA_FUNCTION_VERSION = '7'
  const manejar = crearHandler(dependencias())
  const ok = await manejar(evento('GET /oportunidades', { sub: 'est', grupos: '[estudiante]' }))
  const error = await manejar(evento('POST /oportunidades', { sub: 'emp', grupos: '[empresa]', body: '{malo' }))
  delete process.env.AWS_LAMBDA_FUNCTION_VERSION
  assert.equal(ok.headers['x-app-version'], '7')
  assert.equal(error.headers['x-app-version'], '7')
})