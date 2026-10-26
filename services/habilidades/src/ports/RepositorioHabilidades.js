/**
 * @typedef {{
 * crear(habilidad: object): Promise<object>, listarEstudiante(id: string): Promise<object[]>,
 * listarPendientes(colegioId: string): Promise<object[]>, obtener(estudianteId: string, habilidadId: string): Promise<object|null>,
 * guardar(habilidad: object): Promise<object>
 * }} RepositorioHabilidades
 */
export const puertoRepositorioHabilidades = Symbol('RepositorioHabilidades')
