// Pruebas de las entidades: reglas puras, sin dependencias.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { crearOportunidad } from '../src/domain/Oportunidad.mjs'
import { crearPostulacion, eventoPostulacionCreada } from '../src/domain/Postulacion.mjs'

const contexto = { id: 'opp-1', empresaId: 'empresa-1', ahora: '2026-10-26T12:00:00.000Z' }

test('crea una oferta activa con los datos del servidor', () => {
  const o = crearOportunidad({ titulo: ' Práctica ', descripcion: 'Web', tipo: 'PRACTICA' }, contexto)
  assert.equal(o.titulo, 'Práctica')
  assert.equal(o.empresaId, 'empresa-1')
  assert.equal(o.activa, true)
  assert.equal(o.remoto, false)
  assert.equal('ubicacion' in o, false)
})

test('rechaza un tipo que no existe', () => {
  assert.throws(() => crearOportunidad({ titulo: 'a', descripcion: 'b', tipo: 'CURSO' }, contexto), { estado: 400 })
})

test('rechaza campos que pone el servidor, como empresaId o activa', () => {
  assert.throws(
    () => crearOportunidad({ titulo: 'a', descripcion: 'b', tipo: 'TRABAJO', empresaId: 'otra' }, contexto),
    { estado: 400, message: /empresaId/ },
  )
})

test('exige título y descripción', () => {
  assert.throws(() => crearOportunidad({ descripcion: 'b', tipo: 'TRABAJO' }, contexto), { estado: 400 })
  assert.throws(() => crearOportunidad({ titulo: 'a', descripcion: '   ', tipo: 'TRABAJO' }, contexto), { estado: 400 })
})

test('no se puede postular a una oferta cerrada', () => {
  const cerrada = { ...crearOportunidad({ titulo: 'a', descripcion: 'b', tipo: 'TRABAJO' }, contexto), activa: false }
  assert.throws(() => crearPostulacion(cerrada, 'estudiante-1', contexto.ahora), { estado: 409 })
})

test('el evento cumple el contrato y avisa a la empresa', () => {
  const o = crearOportunidad({ titulo: 'a', descripcion: 'b', tipo: 'TRABAJO' }, contexto)
  const p = crearPostulacion(o, 'estudiante-1', contexto.ahora)
  const e = eventoPostulacionCreada(p, { id: 'evt-1', fecha: contexto.ahora })
  assert.equal(e.tipo, 'PostulacionCreada')
  assert.equal(e.version, 1)
  assert.equal(e.destinatarioId, 'empresa-1')
  assert.deepEqual(Object.keys(e.datos).sort(), ['empresaId', 'estudianteId', 'oportunidadId', 'titulo'])
})