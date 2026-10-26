# Modelo de datos del servicio `habilidades`

**Responsable:** Rol 2. **Tarea:** B1-10. **Casos de uso:** CU-03 y CU-08.
**Tabla:** `ceibbo-app-<stage>`, compartida (`PK`, `SK`, indice `GSI1` con `GSI1PK` y `GSI1SK`).

## Entidad

| Entidad | PK / SK | GSI1PK / GSI1SK | Atributos principales |
|---|---|---|---|
| Habilidad de estudiante | `USER#<estudianteId>` / `SKILL#<habilidadId>` | Mientras esta declarada: `SCHOOL#<colegioId>` / `PENDING#<creadaEn>` | id, nombre, categoria, nivel, estudianteId, colegioId, estado, creadaEn, comentario, revisadaEn |

Los estados validos son `declarada`, `validada` y `rechazada`. Al revisar una habilidad se eliminan las claves del GSI1 para que deje de aparecer entre las pendientes.

## Patrones de acceso

| # | Patron | Operacion | Clave o indice |
|---|---|---|---|
| 1 | Declarar una habilidad | `PutItem` condicional | `USER#<sub> / SKILL#<id-normalizado>` con `attribute_not_exists(PK)` |
| 2 | Listar mis habilidades | `Query` | `PK = USER#<sub>` y `SK` comienza con `SKILL#` |
| 3 | Pendientes del colegio | `Query` | GSI1: `GSI1PK = SCHOOL#<colegioId>` y `GSI1SK` comienza con `PENDING#` |
| 4 | Obtener una habilidad para revisarla | `GetItem` | `USER#<estudianteId> / SKILL#<habilidadId>` |
| 5 | Validar o rechazar | `PutItem` | Conserva PK/SK y quita GSI1PK/GSI1SK |

Ningun patron frecuente usa `Scan`.

## Reglas y dependencias

- El identificador se obtiene normalizando el nombre. La escritura condicional evita que un estudiante declare dos veces la misma habilidad y se traduce a HTTP 409.
- El cliente no decide el `colegioId`. El servicio llama a `GET /perfiles/me` con el mismo access token y toma el colegio desde el perfil del estudiante.
- Para listar o revisar pendientes, el servicio obtiene con `GET /perfiles/me` el `colegioId` del usuario colegio. Nunca compara el colegio con el `sub` de Cognito.
- Solo el colegio cuyo `colegioId` coincide con el guardado en la habilidad puede validarla o rechazarla.
- Una validacion publica `HabilidadValidada` en la cola compartida. Un rechazo no publica ese evento.
- Los errores inesperados se registran en CloudWatch y responden 500 con un mensaje generico.

## Pendientes de fase 2

- Evidencias con URL firmada de S3 (`Valet Key`).
- Escritura condicional al revisar para proteger validaciones concurrentes.
- Consumidores idempotentes de `HabilidadValidada`.
