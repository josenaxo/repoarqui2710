// Entidad Postulacion y su evento. No conoce AWS ni HTTP.
import { ErrorDominio } from './errores.mjs'

export function crearPostulacion(oportunidad, estudianteId, ahora) {
  if (!oportunidad.activa) throw new ErrorDominio(409, 'la oferta está cerrada')
  return {
    oportunidadId: oportunidad.id,
    estudianteId,
    empresaId: oportunidad.empresaId,
    titulo: oportunidad.titulo,
    estado: 'enviada',
    creadaEn: ahora,
  }
}

// Evento según contracts/eventos/PostulacionCreada.json. Se avisa a la empresa dueña de la oferta.
export function eventoPostulacionCreada(postulacion, { id, fecha }) {
  return {
    tipo: 'PostulacionCreada',
    version: 1,
    id,
    fecha,
    destinatarioId: postulacion.empresaId,
    datos: {
      oportunidadId: postulacion.oportunidadId,
      estudianteId: postulacion.estudianteId,
      empresaId: postulacion.empresaId,
      titulo: postulacion.titulo,
    },
  }
}