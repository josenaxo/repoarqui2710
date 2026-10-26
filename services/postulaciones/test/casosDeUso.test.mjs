// Pruebas de los casos de uso con dobles en memoria (sin AWS).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as casos from '../src/application/postulaciones.mjs'
import { dependencias, EMPRESA, OTRA_EMPRESA, ESTUDIANTE, OFERTA } from './dobles.mjs'
import { comprobarPuerto } from '../src/ports/comprobarPuerto.mjs'
import { METODOS_REPOSITORIO_POSTULACIONES } from '../src/ports/RepositorioPostulaciones.mjs'
import { METODOS_PUBLICADOR_EVENTOS } from '../src/ports/PublicadorEventos.mjs'

test('los dobles cumplen los puertos', () => {
  const deps = dependencias()
  assert.doesNotThrow(() => comprobarPuerto('RepositorioPostulaciones', deps.repositorio, METODOS_REPOSITORIO_POSTULACIONES))
  assert.doesNotThrow(() => comprobarPuerto('PublicadorEventos', deps.publicador, METODOS_PUBLICADOR_EVENTOS))
})

test('una empresa publica y la oferta aparece en las listas', async () => {
  const deps = dependencias()
  const o = await casos.publicarOportunidad(deps, { actor: EMPRESA, datos: OFERTA })
  assert.equal(o.empresaId, EMPRESA.id)
  assert.equal((await casos.listarOportunidades(deps, { actor: ESTUDIANTE })).length, 1)
  assert.equal((await casos.misOportunidades(deps, { actor: EMPRESA })).length, 1)
  assert.equal((await casos.misOportunidades(deps, { actor: OTRA_EMPRESA })).length, 0)
})

test('un estudiante no puede publicar ofertas', async () => {
  await assert.rejects(casos.publicarOportunidad(dependencias(), { actor: ESTUDIANTE, datos: OFERTA }), { estado: 403 })
})

test('postular dos veces: la segunda da 409 y no se duplica nada', async () => {
  const deps = dependencias()
  const o = await casos.publicarOportunidad(deps, { actor: EMPRESA, datos: OFERTA })
  await casos.postular(deps, { actor: ESTUDIANTE, oportunidadId: o.id })
  await assert.rejects(casos.postular(deps, { actor: ESTUDIANTE, oportunidadId: o.id }), { estado: 409 })
  assert.equal((await casos.misPostulaciones(deps, { actor: ESTUDIANTE })).length, 1)
  assert.equal(deps.publicador.eventos.length, 1)
})

test('al postular se publica PostulacionCreada para la empresa', async () => {
  const deps = dependencias()
  const o = await casos.publicarOportunidad(deps, { actor: EMPRESA, datos: OFERTA })
  await casos.postular(deps, { actor: ESTUDIANTE, oportunidadId: o.id })
  const [evento] = deps.publicador.eventos
  assert.equal(evento.tipo, 'PostulacionCreada')
  assert.equal(evento.destinatarioId, EMPRESA.id)
  assert.equal(evento.datos.estudianteId, ESTUDIANTE.id)
})

test('si la cola falla, la postulación igual queda guardada', async () => {
  const deps = dependencias()
  deps.publicador = { async publicar() { throw new Error('SQS caído') } }
  const o = await casos.publicarOportunidad(deps, { actor: EMPRESA, datos: OFERTA })
  const original = console.error
  console.error = () => {}
  try {
    await casos.postular(deps, { actor: ESTUDIANTE, oportunidadId: o.id })
  } finally {
    console.error = original
  }
  assert.equal((await casos.misPostulaciones(deps, { actor: ESTUDIANTE })).length, 1)
})

test('postular a una oferta que no existe da 404', async () => {
  await assert.rejects(casos.postular(dependencias(), { actor: ESTUDIANTE, oportunidadId: 'no-existe' }), { estado: 404 })
})

test('una empresa no puede postular', async () => {
  const deps = dependencias()
  const o = await casos.publicarOportunidad(deps, { actor: EMPRESA, datos: OFERTA })
  await assert.rejects(casos.postular(deps, { actor: EMPRESA, oportunidadId: o.id }), { estado: 403 })
})

test('solo la empresa dueña ve los postulantes', async () => {
  const deps = dependencias()
  const o = await casos.publicarOportunidad(deps, { actor: EMPRESA, datos: OFERTA })
  await casos.postular(deps, { actor: ESTUDIANTE, oportunidadId: o.id })
  const postulantes = await casos.listarPostulantes(deps, { actor: EMPRESA, oportunidadId: o.id })
  assert.equal(postulantes.length, 1)
  assert.equal(postulantes[0].estudianteId, ESTUDIANTE.id)
  await assert.rejects(casos.listarPostulantes(deps, { actor: OTRA_EMPRESA, oportunidadId: o.id }), { estado: 403 })
})

test('las ofertas cerradas no aparecen en la lista general', async () => {
  const deps = dependencias()
  const o = await casos.publicarOportunidad(deps, { actor: EMPRESA, datos: OFERTA })
  await deps.repositorio.guardarOportunidad({ ...o, activa: false })
  assert.equal((await casos.listarOportunidades(deps, { actor: ESTUDIANTE })).length, 0)
})