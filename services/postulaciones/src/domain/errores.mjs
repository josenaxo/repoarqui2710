// Error del dominio: trae el código HTTP que corresponde, pero no sabe nada de HTTP.
// El handler lo traduce a una respuesta; cualquier otro error es un 500.
export class ErrorDominio extends Error {
  constructor(estado, mensaje) {
    super(mensaje)
    this.estado = estado
  }
}