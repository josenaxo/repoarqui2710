export function normalizarHabilidad(nombre) {
  return nombre.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')
}

function errorValidacion(mensaje) {
  return Object.assign(new Error(mensaje), { statusCode: 400 })
}

export function declarar(datos) {
  if (!datos.nombre?.trim()) throw errorValidacion('nombre es obligatorio')
  if (!datos.estudianteId || !datos.colegioId) throw errorValidacion('estudianteId y colegioId son obligatorios')
  const categoria = datos.categoria ?? 'TECNICA'
  const nivel = Number(datos.nivel ?? 1)
  if (!['TECNICA', 'BLANDA', 'CERTIFICACION'].includes(categoria)) throw errorValidacion('categoria invalida')
  if (!Number.isInteger(nivel) || nivel < 1 || nivel > 5) throw errorValidacion('nivel debe estar entre 1 y 5')
  const fecha = new Date().toISOString()
  return {
    id: normalizarHabilidad(datos.nombre),
    nombre: datos.nombre.trim(),
    categoria,
    nivel,
    estudianteId: datos.estudianteId,
    colegioId: datos.colegioId,
    estado: 'declarada',
    creadaEn: fecha,
  }
}

export function decidirValidacion(habilidad, estado, comentario = '') {
  if (!['validada', 'rechazada'].includes(estado)) throw errorValidacion('estado inválido')
  if (habilidad.estado !== 'declarada') throw Object.assign(new Error('la habilidad ya fue revisada'), { statusCode: 409 })
  return { ...habilidad, estado, comentario, revisadaEn: new Date().toISOString() }
}
