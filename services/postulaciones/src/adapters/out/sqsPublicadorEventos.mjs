// Adaptador de salida: implementa el puerto PublicadorEventos con la cola SQS de infra/shared.
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs'
import { comprobarPuerto } from '../../ports/comprobarPuerto.mjs'
import { METODOS_PUBLICADOR_EVENTOS } from '../../ports/PublicadorEventos.mjs'

const sqs = new SQSClient({})

export const publicadorEventosSqs = comprobarPuerto(
  'PublicadorEventos',
  {
    async publicar(evento) {
      await sqs.send(new SendMessageCommand({
        QueueUrl: process.env.EVENTS_QUEUE_URL,
        MessageBody: JSON.stringify(evento),
      }))
    },
  },
  METODOS_PUBLICADOR_EVENTOS,
)