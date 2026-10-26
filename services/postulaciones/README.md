# Servicio `postulaciones`

Ofertas de empresas y postulaciones de estudiantes. Cubre el núcleo de CU-04 a CU-07.

- **Responsable:** Rol 1
- **Contrato de API:** [`contracts/api/postulaciones.yaml`](../../contracts/api/postulaciones.yaml)
- **Evento que publica:** [`contracts/eventos/PostulacionCreada.json`](../../contracts/eventos/PostulacionCreada.json)
- **Modelo de datos:** [`docs/datos/postulaciones.md`](../../docs/datos/postulaciones.md)

## Rutas

Todas exigen el access token de Cognito (`Authorization: Bearer <token>`).

| Ruta | Qué hace | Quién |
|---|---|---|
| `POST /oportunidades` | Publica una oferta | `empresa` |
| `GET /oportunidades` | Lista las ofertas activas, más nuevas primero | cualquier usuario con sesión |
| `GET /oportunidades/mias` | Lista las ofertas de la empresa | `empresa` |
| `POST /oportunidades/{id}/postulaciones` | Postula a una oferta (409 si ya postuló) y publica `PostulacionCreada` | `estudiante` |
| `GET /oportunidades/{id}/postulaciones` | Lista los postulantes de una oferta | `empresa` dueña de la oferta |
| `GET /postulaciones/mias` | Lista las postulaciones del estudiante | `estudiante` |

Errores: 400 datos inválidos, 401 sin token, 403 sin permiso, 404 la oferta no existe, 409 ya postulaste o la oferta está cerrada.

## Estructura (arquitectura hexagonal)

```
src/domain/        reglas del negocio (Oportunidad, Postulacion), sin AWS
src/ports/         contratos: RepositorioPostulaciones y PublicadorEventos
src/application/   casos de uso; reciben las dependencias por parámetro
src/adapters/in/   handler HTTP de la Lambda (una función, seis rutas)
src/adapters/out/  DynamoDB y SQS
test/              20 pruebas con dobles en memoria, sin AWS
```

## Probar y desplegar

```bash
cd services/postulaciones
npm install
npm test                                 # 20 pruebas, sin AWS
serverless deploy --stage <rol1|rol2|rol3|demo>   # antes: infra/shared en el mismo stage
```

Prueba de punta a punta con los usuarios de prueba (scripts de B1-17):

```bash
export CEIBBO_TEST_PASSWORD='<contraseña>'
bash scripts/aws/crear-usuarios-prueba.sh rol1
EMP=$(bash scripts/aws/token.sh rol1 empresa@ceibbo.cl)
EST=$(bash scripts/aws/token.sh rol1 estudiante@ceibbo.cl)
curl -X POST $API/oportunidades -H "Authorization: Bearer $EMP" -H "Content-Type: application/json" \
  -d '{"titulo":"Práctica","descripcion":"Web","tipo":"PRACTICA"}'
curl -X POST $API/oportunidades/<id>/postulaciones -H "Authorization: Bearer $EST"   # 201, y 409 la segunda vez
aws sqs receive-message --queue-url <EventsQueueUrl>                                 # el evento PostulacionCreada
```

## Decisiones y patrones

- **Idempotencia con escritura condicional:** la clave `OPPORTUNITY#<id> / APPLICATION#<estudiante>` permite una sola postulación por oferta. `attribute_not_exists(PK)` hace que el segundo intento responda 409, incluso con dos peticiones simultáneas.
- **Item collection:** la oferta y sus postulaciones comparten la PK, así que "ver postulantes" es una sola Query.
- **Datos copiados a propósito:** la postulación guarda el título y la empresa para que "mis postulaciones" no lea cada oferta.
- **Autorización por dueño:** el grupo `empresa` no basta para ver postulantes; la oferta tiene que ser suya.
- **Publicación de eventos:** si la cola falla después de guardar, la postulación se mantiene y el error queda en CloudWatch.
- **Ids y reloj inyectados** en los casos de uso, para que las pruebas sean repetibles.

## Pendiente para la fase 2

- `TransactWriteItems` para crear la postulación y sumar `applicantsCount` en una sola operación.
- Patrón Outbox para no perder `PostulacionCreada` si la cola falla.
- Cambiar estado (en revisión, aceptada, rechazada), editar y cerrar ofertas.
- Índice `GSI2` por empresa, para "mis ofertas" sin filtro.
- Compatibilidad estudiante-oferta usando las habilidades validadas.