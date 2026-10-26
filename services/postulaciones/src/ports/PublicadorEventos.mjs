// Puerto de salida: publicar un evento para otros servicios.
// Lo implementa el adaptador de SQS y, en las pruebas, uno que guarda los eventos en una lista.
//
// publicar(evento) -> Promise<void>
export const METODOS_PUBLICADOR_EVENTOS = Object.freeze(['publicar'])