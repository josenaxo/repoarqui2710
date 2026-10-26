import test from 'node:test'
import assert from 'node:assert/strict'
import { crearLectorPerfilesHttp } from '../src/adapters/out/httpLectorPerfiles.js'

test('consulta GET /perfiles/me con el token recibido', async () => {
  let llamada
  const fetchImpl = async (url, opciones) => {
    llamada = { url, opciones }
    return { ok: true, async json() { return { tipo: 'colegio', colegioId: 'school-1' } } }
  }
  const lector = crearLectorPerfilesHttp({ baseUrl: 'https://api.example/', fetchImpl })
  const perfil = await lector.obtenerPropio('token-123')
  assert.deepEqual(perfil, { tipo: 'colegio', colegioId: 'school-1' })
  assert.equal(llamada.url, 'https://api.example/perfiles/me')
  assert.equal(llamada.opciones.headers.authorization, 'Bearer token-123')
})

test('un fallo 500 de perfiles se mantiene como error inesperado', async () => {
  const lector = crearLectorPerfilesHttp({
    baseUrl: 'https://api.example',
    fetchImpl: async () => ({ ok: false, status: 500 }),
  })
  await assert.rejects(() => lector.obtenerPropio('token-123'), (error) => error.statusCode === undefined)
})
