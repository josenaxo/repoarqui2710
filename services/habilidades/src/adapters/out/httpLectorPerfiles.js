function errorHttp(statusCode, mensaje) {
  return Object.assign(new Error(mensaje), { statusCode })
}

export function crearLectorPerfilesHttp({
  baseUrl = process.env.API_BASE_URL,
  fetchImpl = globalThis.fetch,
} = {}) {
  return {
    async obtenerPropio(token) {
      if (!baseUrl) throw new Error('Falta API_BASE_URL')
      if (!token) throw errorHttp(401, 'Falta el token de acceso')

      const respuesta = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/perfiles/me`, {
        headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
      })

      if (respuesta.ok) return respuesta.json()
      if (respuesta.status === 401) throw errorHttp(401, 'Token no valido')
      if (respuesta.status === 403) throw errorHttp(403, 'Acceso denegado al perfil')
      if (respuesta.status === 404) throw errorHttp(404, 'Perfil no encontrado')
      throw new Error(`El servicio perfiles respondio ${respuesta.status}`)
    },
  }
}
