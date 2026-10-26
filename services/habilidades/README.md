# Servicio habilidades

Implementa CU-03/CU-08 con escritura condicional para evitar duplicados y publicación del evento `HabilidadValidada` en SQS. El `colegioId` se obtiene desde `GET /perfiles/me` con el token del usuario; nunca se acepta desde el body ni se confunde con el `sub` de Cognito.

```powershell
npm.cmd test
npm.cmd run typecheck
npx.cmd serverless deploy --stage rol2
```

Rutas: `POST /habilidades`, `GET /habilidades/me`, `GET /habilidades/pendientes` y `PATCH /habilidades/{estudianteId}/{habilidadId}`.

El stack compartido entrega `TABLE_NAME`, `EVENTS_QUEUE_URL` y `API_BASE_URL`. Antes de desplegar este servicio deben estar desplegados `infra/shared` y `services/perfiles` en el mismo stage.
