// Adaptador de salida: implementa el puerto RepositorioPostulaciones con DynamoDB.
// Las claves (PK, SK, GSI1) salen de docs/datos/postulaciones.md y solo se conocen aquí.
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { comprobarPuerto } from '../../ports/comprobarPuerto.mjs'
import { METODOS_REPOSITORIO_POSTULACIONES } from '../../ports/RepositorioPostulaciones.mjs'

const endpoint = process.env.DYNAMO_ENDPOINT
const db = DynamoDBDocumentClient.from(new DynamoDBClient(endpoint ? { endpoint } : {}))
const tabla = () => process.env.TABLE_NAME

// Quita las claves técnicas antes de devolver un ítem al caso de uso.
function sinClaves({ PK, SK, GSI1PK, GSI1SK, ...datos }) {
  return datos
}

// Una Query devuelve hasta 1 MB por vez; se repite mientras haya más páginas.
async function consultarTodo(parametros) {
  const items = []
  let desde
  do {
    const respuesta = await db.send(new QueryCommand({ TableName: tabla(), ...parametros, ExclusiveStartKey: desde }))
    items.push(...respuesta.Items)
    desde = respuesta.LastEvaluatedKey
  } while (desde)
  return items.map(sinClaves)
}

const esCondicionFallida = (error) => error?.name === 'ConditionalCheckFailedException'

export const repositorioPostulacionesDynamo = comprobarPuerto(
  'RepositorioPostulaciones',
  {
    async guardarOportunidad(oportunidad) {
      await db.send(new PutCommand({
        TableName: tabla(),
        Item: {
          PK: `OPPORTUNITY#${oportunidad.id}`,
          SK: 'DETAIL',
          GSI1PK: 'OPPORTUNITIES',
          GSI1SK: `${oportunidad.creadaEn}#${oportunidad.id}`,
          ...oportunidad,
        },
        ConditionExpression: 'attribute_not_exists(PK)',
      }))
    },

    async obtenerOportunidad(id) {
      const { Item } = await db.send(new GetCommand({
        TableName: tabla(),
        Key: { PK: `OPPORTUNITY#${id}`, SK: 'DETAIL' },
      }))
      return Item ? sinClaves(Item) : null
    },

    async listarOportunidades() {
      return consultarTodo({
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: { ':pk': 'OPPORTUNITIES' },
        ScanIndexForward: false,
      })
    },

    async listarOportunidadesEmpresa(empresaId) {
      return consultarTodo({
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        FilterExpression: 'empresaId = :empresa',
        ExpressionAttributeValues: { ':pk': 'OPPORTUNITIES', ':empresa': empresaId },
        ScanIndexForward: false,
      })
    },

    async crearPostulacion(postulacion) {
      try {
        await db.send(new PutCommand({
          TableName: tabla(),
          Item: {
            PK: `OPPORTUNITY#${postulacion.oportunidadId}`,
            SK: `APPLICATION#${postulacion.estudianteId}`,
            GSI1PK: `STUDENT#${postulacion.estudianteId}`,
            GSI1SK: `APPLICATION#${postulacion.creadaEn}`,
            ...postulacion,
          },
          ConditionExpression: 'attribute_not_exists(PK)',
        }))
        return true
      } catch (error) {
        if (esCondicionFallida(error)) return false
        throw error
      }
    },

    async listarPostulacionesEstudiante(estudianteId) {
      return consultarTodo({
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: { ':pk': `STUDENT#${estudianteId}` },
        ScanIndexForward: false,
      })
    },

    async listarPostulantes(oportunidadId) {
      return consultarTodo({
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefijo)',
        ExpressionAttributeValues: { ':pk': `OPPORTUNITY#${oportunidadId}`, ':prefijo': 'APPLICATION#' },
      })
    },
  },
  METODOS_REPOSITORIO_POSTULACIONES,
)