import test from 'node:test'
import assert from 'node:assert/strict'
import { crearServicioHabilidades } from '../src/application/servicioHabilidades.js'

function dobles() {
  const items = new Map()
  const publicados = []
  const consultasPerfil = []
  const perfilesPorToken = new Map([
    ['token-estudiante', { userId: 'e1', tipo: 'estudiante', colegioId: 'school-1' }],
    ['token-colegio-1', { userId: 'sub-colegio-1', tipo: 'colegio', colegioId: 'school-1' }],
    ['token-colegio-2', { userId: 'sub-colegio-2', tipo: 'colegio', colegioId: 'school-2' }],
  ])
  return {
    publicados,
    consultasPerfil,
    repo: {
      async crear(h) {
        const key = `${h.estudianteId}:${h.id}`
        if (items.has(key)) throw Object.assign(new Error('habilidad duplicada'), { statusCode: 409 })
        items.set(key, h); return h
      },
      async listarEstudiante(id) { return [...items.values()].filter((h) => h.estudianteId === id) },
      async listarPendientes(id) { return [...items.values()].filter((h) => h.colegioId === id && h.estado === 'declarada') },
      async obtener(e, h) { return items.get(`${e}:${h}`) ?? null },
      async guardar(h) { items.set(`${h.estudianteId}:${h.id}`, h); return h },
    },
    eventos: { async publicar(evento) { publicados.push(evento) } },
    perfiles: {
      async obtenerPropio(token) {
        consultasPerfil.push(token)
        return perfilesPorToken.get(token) ?? null
      },
    },
  }
}

test('la declaración duplicada responde conflicto', async () => {
  const d = dobles(); const servicio = crearServicioHabilidades(d.repo, d.eventos, d.perfiles)
  const actor = { id: 'e1', rol: 'estudiante', token: 'token-estudiante' }
  await servicio.declarar(actor, { nombre: 'Node.js' })
  await assert.rejects(() => servicio.declarar(actor, { nombre: 'Node.js' }), (error) => error.statusCode === 409)
})

test('el colegioId sale del perfil del estudiante y no del body', async () => {
  const d = dobles(); const servicio = crearServicioHabilidades(d.repo, d.eventos, d.perfiles)
  const habilidad = await servicio.declarar(
    { id: 'e1', rol: 'estudiante', token: 'token-estudiante' },
    { nombre: 'Docker', colegioId: 'school-falso' },
  )
  assert.equal(habilidad.colegioId, 'school-1')
  assert.deepEqual(d.consultasPerfil, ['token-estudiante'])
})

test('el colegio dueño valida usando el colegioId de su perfil y publica HabilidadValidada', async () => {
  const d = dobles(); const servicio = crearServicioHabilidades(d.repo, d.eventos, d.perfiles)
  const habilidad = await servicio.declarar(
    { id: 'e1', rol: 'estudiante', token: 'token-estudiante' },
    { nombre: 'Docker' },
  )
  const resultado = await servicio.revisar(
    { id: 'sub-colegio-1', rol: 'colegio', token: 'token-colegio-1' },
    'e1', habilidad.id, { estado: 'validada' },
  )
  assert.equal(resultado.estado, 'validada')
  assert.equal(d.publicados[0].tipo, 'HabilidadValidada')
  assert.equal(d.publicados[0].datos.colegioId, 'school-1')
})

test('otro colegio no puede validar', async () => {
  const d = dobles(); const servicio = crearServicioHabilidades(d.repo, d.eventos, d.perfiles)
  const habilidad = await servicio.declarar(
    { id: 'e1', rol: 'estudiante', token: 'token-estudiante' },
    { nombre: 'AWS' },
  )
  await assert.rejects(
    () => servicio.revisar(
      { id: 'sub-colegio-2', rol: 'colegio', token: 'token-colegio-2' },
      'e1', habilidad.id, { estado: 'validada' },
    ),
    (error) => error.statusCode === 403,
  )
})

test('los pendientes se consultan por colegioId y no por el sub del colegio', async () => {
  const d = dobles(); const servicio = crearServicioHabilidades(d.repo, d.eventos, d.perfiles)
  await servicio.declarar(
    { id: 'e1', rol: 'estudiante', token: 'token-estudiante' },
    { nombre: 'Git' },
  )
  const pendientes = await servicio.listarPendientes({
    id: 'sub-colegio-1', rol: 'colegio', token: 'token-colegio-1',
  })
  assert.equal(pendientes.length, 1)
  assert.equal(pendientes[0].colegioId, 'school-1')
})
