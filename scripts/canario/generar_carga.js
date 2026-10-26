const url = process.env.URL ?? process.argv[2]
const token = process.env.TOKEN
const total = Number(process.env.TOTAL ?? 100)
const concurrencia = Number(process.env.CONCURRENCIA ?? 10)

function enteroPositivo(nombre, valor) {
  if (!Number.isInteger(valor) || valor <= 0) {
    console.error(`${nombre} debe ser un entero positivo.`)
    process.exit(2)
  }
}

if (!url) {
  console.error('Falta URL. Define la variable URL o pasala como primer argumento.')
  process.exit(2)
}

if (!token) {
  console.error('Falta TOKEN. Debe contener un access token de Cognito.')
  process.exit(2)
}

enteroPositivo('TOTAL', total)
enteroPositivo('CONCURRENCIA', concurrencia)

let siguiente = 0
const resultados = []

async function enviarPeticion() {
  const inicio = performance.now()

  try {
    const respuesta = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    await respuesta.arrayBuffer()
    resultados.push({
      estado: String(respuesta.status),
      version: respuesta.headers.get('x-app-version') ?? 'sin-version',
      duracionMs: performance.now() - inicio,
    })
  } catch (error) {
    resultados.push({
      estado: 'error-red',
      version: 'sin-version',
      duracionMs: performance.now() - inicio,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

async function trabajador() {
  while (true) {
    const numero = siguiente++
    if (numero >= total) return
    await enviarPeticion()
  }
}

function contarPor(campo) {
  return resultados.reduce((conteo, resultado) => {
    const valor = resultado[campo]
    conteo[valor] = (conteo[valor] ?? 0) + 1
    return conteo
  }, {})
}

async function main() {
  const trabajadores = Math.min(concurrencia, total)
  await Promise.all(Array.from({ length: trabajadores }, () => trabajador()))

  const duraciones = resultados
    .map(({ duracionMs }) => duracionMs)
    .sort((a, b) => a - b)
  const indiceP95 = Math.max(0, Math.ceil(duraciones.length * 0.95) - 1)
  const fallidas = resultados.filter(({ estado }) => !estado.startsWith('2')).length

  console.log(JSON.stringify({
    url,
    total: resultados.length,
    concurrencia: trabajadores,
    estados: contarPor('estado'),
    versiones: contarPor('version'),
    erroresPorcentaje: Number(((fallidas / resultados.length) * 100).toFixed(2)),
    p95Ms: Number(duraciones[indiceP95].toFixed(2)),
  }, null, 2))

  if (fallidas > 0) process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
