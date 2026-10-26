import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DeleteCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'

process.env.DYNAMO_ENDPOINT ??= 'http://localhost:8000'
process.env.AWS_REGION ??= 'us-east-1'
process.env.AWS_ACCESS_KEY_ID ??= 'local'
process.env.AWS_SECRET_ACCESS_KEY ??= 'local'
process.env.TABLE_NAME ??= 'ceibbo-app-local'

const { repositorioHabilidadesDynamo: repositorio } = await import('../../src/adapters/out/dynamoRepositorioHabilidades.js')
const db = DynamoDBDocumentClient.from(new DynamoDBClient({
  endpoint: process.env.DYNAMO_ENDPOINT,
  region: process.env.AWS_REGION,
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
}))

test('crea sin duplicar, lista por colegio y quita la habilidad revisada de pendientes', async (t) => {
  const sufijo = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const habilidad = {
    id: `docker-${sufijo}`,
    nombre: 'Docker',
    categoria: 'TECNICA',
    nivel: 3,
    estudianteId: `estudiante-${sufijo}`,
    colegioId: `school-${sufijo}`,
    estado: 'declarada',
    creadaEn: new Date().toISOString(),
  }

  t.after(async () => {
    await db.send(new DeleteCommand({
      TableName: process.env.TABLE_NAME,
      Key: { PK: `USER#${habilidad.estudianteId}`, SK: `SKILL#${habilidad.id}` },
    }))
  })

  assert.deepEqual(await repositorio.crear(habilidad), habilidad)
  await assert.rejects(() => repositorio.crear(habilidad), (error) => error.statusCode === 409)
  assert.equal((await repositorio.listarEstudiante(habilidad.estudianteId)).length, 1)
  assert.equal((await repositorio.listarPendientes(habilidad.colegioId)).length, 1)

  await repositorio.guardar({ ...habilidad, estado: 'validada', revisadaEn: new Date().toISOString() })
  assert.equal((await repositorio.listarPendientes(habilidad.colegioId)).length, 0)
})
