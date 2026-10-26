async function sdk() {
  const [{ DynamoDBClient }, lib] = await Promise.all([import('@aws-sdk/client-dynamodb'), import('@aws-sdk/lib-dynamodb')])
  const endpoint = process.env.DYNAMO_ENDPOINT
  const db = lib.DynamoDBDocumentClient.from(new DynamoDBClient(endpoint ? {
    endpoint, region: process.env.AWS_REGION ?? 'us-east-1',
    credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
  } : {}))
  return { db, ...lib }
}

export const repositorioHabilidadesDynamo = {
  async crear(habilidad) {
    const { db, PutCommand } = await sdk()
    const item = {
      PK: `USER#${habilidad.estudianteId}`, SK: `SKILL#${habilidad.id}`,
      GSI1PK: `SCHOOL#${habilidad.colegioId}`, GSI1SK: `PENDING#${habilidad.creadaEn}`,
      ...habilidad,
    }
    try {
      await db.send(new PutCommand({ TableName: process.env.TABLE_NAME, Item: item, ConditionExpression: 'attribute_not_exists(PK)' }))
      return habilidad
    } catch (error) {
      if (error.name === 'ConditionalCheckFailedException') throw Object.assign(new Error('habilidad duplicada'), { statusCode: 409 })
      throw error
    }
  },
  async listarEstudiante(id) {
    const { db, QueryCommand } = await sdk()
    const result = await db.send(new QueryCommand({
      TableName: process.env.TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: { ':pk': `USER#${id}`, ':sk': 'SKILL#' },
    }))
    return result.Items ?? []
  },
  async listarPendientes(colegioId) {
    const { db, QueryCommand } = await sdk()
    const result = await db.send(new QueryCommand({
      TableName: process.env.TABLE_NAME, IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :sk)',
      ExpressionAttributeValues: { ':pk': `SCHOOL#${colegioId}`, ':sk': 'PENDING#' },
    }))
    return result.Items ?? []
  },
  async obtener(estudianteId, habilidadId) {
    const { db, GetCommand } = await sdk()
    const result = await db.send(new GetCommand({
      TableName: process.env.TABLE_NAME,
      Key: { PK: `USER#${estudianteId}`, SK: `SKILL#${habilidadId}` },
    }))
    return result.Item ?? null
  },
  async guardar(habilidad) {
    const { db, PutCommand } = await sdk()
    const item = { PK: `USER#${habilidad.estudianteId}`, SK: `SKILL#${habilidad.id}`, ...habilidad }
    await db.send(new PutCommand({ TableName: process.env.TABLE_NAME, Item: item }))
    return habilidad
  },
}
