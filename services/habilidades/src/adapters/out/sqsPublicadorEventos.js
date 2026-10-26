export const publicadorEventosSqs = {
  async publicar(evento) {
    const { SQSClient, SendMessageCommand } = await import('@aws-sdk/client-sqs')
    await new SQSClient({}).send(new SendMessageCommand({
      QueueUrl: process.env.EVENTS_QUEUE_URL,
      MessageBody: JSON.stringify(evento),
    }))
  },
}
