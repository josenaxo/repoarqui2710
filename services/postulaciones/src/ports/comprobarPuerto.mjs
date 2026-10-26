// Revisa que un adaptador tenga todos los métodos que exige su puerto.
// Así, si falta uno, falla al arrancar con un mensaje claro y no en medio de una petición.
export function comprobarPuerto(nombrePuerto, implementacion, metodos) {
  const faltantes = metodos.filter((metodo) => typeof implementacion?.[metodo] !== 'function')
  if (faltantes.length > 0) {
    throw new Error(`${nombrePuerto}: faltan los métodos ${faltantes.join(', ')}`)
  }
  return implementacion
}