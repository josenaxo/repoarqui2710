# Modelo de datos del servicio `postulaciones`

**Responsable:** Rol 1. **Tarea:** B1-10. **Casos de uso:** CU-04 a CU-07 (núcleo).
**Tabla:** `ceibbo-app-<stage>`, compartida (`PK`, `SK`, índice `GSI1` con `GSI1PK` y `GSI1SK`).

## Entidades

| Entidad | PK / SK | GSI1PK / GSI1SK | Atributos principales |
|---|---|---|---|
| Oportunidad | `OPPORTUNITY#<id>` / `DETAIL` | `OPPORTUNITIES` / `<creadaEn>#<id>` | id, empresaId, titulo, descripcion, tipo, ubicacion, remoto, especialidad, activa, creadaEn |
| Postulación | `OPPORTUNITY#<oportunidadId>` / `APPLICATION#<estudianteId>` | `STUDENT#<estudianteId>` / `APPLICATION#<creadaEn>` | oportunidadId, estudianteId, empresaId, titulo, estado, creadaEn |

- La oferta y sus postulaciones comparten la PK `OPPORTUNITY#<id>` (*item collection*): se leen juntas con una sola Query.
- `tipo` es uno de `PASANTIA`, `PRACTICA`, `TRABAJO` o `PROYECTO`. `estado` de la postulación empieza en `enviada`.
- `empresaId` y `estudianteId` son el `sub` de Cognito del usuario que publicó o postuló. Nunca vienen en el body.
- La postulación copia `titulo` y `empresaId` de la oferta para que "mis postulaciones" no tenga que leer cada oferta.

## Patrones de acceso (fase 1)

| # | Patrón | Pantalla | Operación | Clave | Índice |
|---|---|---|---|---|---|
| 1 | Publicar una oferta | `empresa/ofertas` | PutItem condicional | `OPPORTUNITY#id / DETAIL` con `attribute_not_exists(PK)` | tabla |
| 2 | Ofertas activas, más nuevas primero | `student/oportunidades` | Query | `GSI1PK = OPPORTUNITIES`, orden descendente | GSI1 |
| 3 | Mis ofertas (empresa) | `empresa/ofertas` | Query + filtro | `GSI1PK = OPPORTUNITIES`, filtro `empresaId = <sub>` | GSI1 |
| 4 | Obtener una oferta | al postular y al ver postulantes | GetItem | `OPPORTUNITY#id / DETAIL` | tabla |
| 5 | Postular sin duplicar | `student/oportunidades` | PutItem condicional | `OPPORTUNITY#id / APPLICATION#<sub>` con `attribute_not_exists(PK)`, 409 si ya existe | tabla |
| 6 | Mis postulaciones (estudiante) | `student/postulaciones` | Query | `GSI1PK = STUDENT#<sub>` | GSI1 |
| 7 | Postulantes de una oferta | `empresa/ofertas` | Query | `PK = OPPORTUNITY#id`, `SK` empieza con `APPLICATION#` | tabla |

**Ningún patrón usa `Scan`.** El patrón 3 es una Query con filtro: lee todas las ofertas y devuelve solo las de la empresa. Con pocas ofertas es aceptable; en la fase 2 se agrega un índice `GSI2` con `COMPANY#<empresaId>`.

## Reglas del dominio

- Solo el grupo `empresa` publica ofertas y ve sus postulantes; solo el grupo `estudiante` postula.
- Una empresa solo ve los postulantes de **sus** ofertas (`empresaId` de la oferta = `sub` del token); si no, 403.
- No se puede postular a una oferta que no existe (404) ni a una cerrada (`activa = false`, 409).
- **Idempotencia:** un estudiante tiene como máximo una postulación por oferta. La clave `OPPORTUNITY#id / APPLICATION#<sub>` lo garantiza y la escritura condicional responde 409 al segundo intento, incluso si llegan dos peticiones al mismo tiempo.
- Al crear la postulación se publica el evento `PostulacionCreada` en la cola de eventos, con destinatario la empresa (contrato en `contracts/eventos/PostulacionCreada.json`).

## Pendientes para la fase 2

| Pendiente | Diseño propuesto |
|---|---|
| Contador de postulantes (`applicantsCount`) | `TransactWriteItems`: crear la postulación y sumar 1 a la oferta en una sola operación (todo o nada) |
| Cambiar estado (en revisión, aceptada, rechazada) | `UpdateItem` condicional, solo la empresa dueña |
| Editar y cerrar ofertas | `UpdateItem` sobre `OPPORTUNITY#id / DETAIL` |
| Mis ofertas sin filtro | Índice `GSI2`: `COMPANY#<empresaId>` / `<creadaEn>` |
| Evento perdido si la cola falla después de guardar | Patrón Outbox: guardar el evento en la tabla en la misma transacción y publicarlo después |
| Compatibilidad estudiante-oferta | Cálculo con las habilidades validadas (evento `HabilidadValidada`) |