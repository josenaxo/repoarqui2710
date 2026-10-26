// Puerto de salida: lo que los casos de uso necesitan guardar y leer.
// Lo implementa el adaptador de DynamoDB y, en las pruebas, uno en memoria.
//
// guardarOportunidad(oportunidad) -> Promise<void>
// obtenerOportunidad(id) -> Promise<oportunidad | null>
// listarOportunidades() -> Promise<oportunidad[]>              (más nuevas primero)
// listarOportunidadesEmpresa(empresaId) -> Promise<oportunidad[]>
// crearPostulacion(postulacion) -> Promise<boolean>           (false si ya existía)
// listarPostulacionesEstudiante(estudianteId) -> Promise<postulacion[]>
// listarPostulantes(oportunidadId) -> Promise<postulacion[]>
export const METODOS_REPOSITORIO_POSTULACIONES = Object.freeze([
  'guardarOportunidad',
  'obtenerOportunidad',
  'listarOportunidades',
  'listarOportunidadesEmpresa',
  'crearPostulacion',
  'listarPostulacionesEstudiante',
  'listarPostulantes',
])