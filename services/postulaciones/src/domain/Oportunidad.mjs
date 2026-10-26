// Entidad Oportunidad: reglas para crear una oferta válida. No conoce AWS ni HTTP.
import { ErrorDominio } from './errores.mjs'

export const TIPOS = Object.freeze(['PASANTIA', 'PRACTICA', 'TRABAJO', 'PROYECTO'])
const PERMITIDOS = ['titulo', 'descripcion', 'tipo', 'ubicacion', 'remoto', 'especialidad']

function texto(datos, campo, maximo, obligatorio) {
  const valor = datos[campo]
  if (valor === undefined && !obligatorio) return undefined
  if (typeof valor !== 'string' || valor.trim() === '') throw new ErrorDominio(400, `${campo} es obligatorio`)
  if (valor.trim().length > maximo) throw new ErrorDominio(400, `${campo} admite hasta ${maximo} caracteres`)
  return valor.trim()
}

export function crearOportunidad(datos, { id, empresaId, ahora }) {
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
    throw new ErrorDominio(400, 'el cuerpo debe ser un objeto JSON')
  }
  const extra = Object.keys(datos).filter((campo) => !PERMITIDOS.includes(campo))
  if (extra.length > 0) throw new ErrorDominio(400, `campos no permitidos: ${extra.join(', ')}`)
  if (!TIPOS.includes(datos.tipo)) throw new ErrorDominio(400, `tipo debe ser uno de: ${TIPOS.join(', ')}`)
  if (datos.remoto !== undefined && typeof datos.remoto !== 'boolean') {
    throw new ErrorDominio(400, 'remoto debe ser true o false')
  }

  const oportunidad = {
    id,
    empresaId,
    titulo: texto(datos, 'titulo', 120, true),
    descripcion: texto(datos, 'descripcion', 2000, true),
    tipo: datos.tipo,
    remoto: datos.remoto ?? false,
    activa: true,
    creadaEn: ahora,
  }
  const ubicacion = texto(datos, 'ubicacion', 120, false)
  const especialidad = texto(datos, 'especialidad', 80, false)
  if (ubicacion) oportunidad.ubicacion = ubicacion
  if (especialidad) oportunidad.especialidad = especialidad
  return oportunidad
}