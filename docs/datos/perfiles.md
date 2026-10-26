# Modelo de datos del servicio `perfiles`

**Responsable:** Rol 3. **Tarea:** B1-10. **Casos de uso:** CU-01, CU-02 y la personalización por colegio.
**Tabla:** `ceibbo-app-<stage>`, compartida (`PK`, `SK`, índice `GSI1` con `GSI1PK` y `GSI1SK`)

## Entidades

| Entidad | PK / SK | GSI1PK / GSI1SK | Atributos principales |
|---|---|---|---|
| Perfil de estudiante | `USER#<userId>` / `PROFILE` | `SCHOOL#<colegioId>` / `STUDENT#<userId>` | tipo=`estudiante`, nombre, apellido, titular, bio, especialidad, año, teléfono, ubicación, avatar, links, colegioId, readinessScore, profileViews |
| Perfil de empresa | `USER#<userId>` / `PROFILE` | no tiene | tipo=`empresa`, nombre, descripción, industria, tamaño, ubicación, sitioWeb, logo |
| Perfil de usuario colegio | `USER#<userId>` / `PROFILE` | no tiene | tipo=`colegio`, colegioId, email |
| Colegio y su configuración | `SCHOOL#<colegioId>` / `CONFIG` | `SCHOOLS` / `SCHOOL#<colegioId>` | nombre, descripción, ubicación, sitioWeb, especialidades, **logo, colorPrincipal, bienvenida** |

- Los tres tipos de perfil usan la misma dirección (`USER#id / PROFILE`). El atributo `tipo` los distingue.
- El índice es **disperso**: solo entran a GSI1 los estudiantes con colegio y los ítems `CONFIG` de cada colegio.

## Patrones de acceso (fase 1)

| # | Patrón | Pantalla | Operación | Clave | Índice |
|---|---|---|---|---|---|
| 1 | Crear mi perfil | Registro (después del login) | PutItem condicional | `USER#id / PROFILE` con `attribute_not_exists(PK)`, 409 si ya existe | tabla |
| 2 | Ver mi perfil | `*/perfil`, encabezado de todas las páginas | GetItem | `USER#id / PROFILE` | tabla |
| 3 | Editar mi perfil | `*/perfil/editar` | UpdateItem condicional | `USER#id / PROFILE` con `attribute_exists(PK)`, 404 si no existe | tabla |
| 4 | Ver la configuración de un colegio | Layout del estudiante, perfil del colegio | GetItem | `SCHOOL#id / CONFIG` | tabla |
| 5 | Editar la configuración del colegio | `colegio/perfil/editar` | PutItem | `SCHOOL#id / CONFIG` (solo el grupo `colegio`, y solo su propio colegio) | tabla |
| 6 | Listar colegios | Selector de colegio en `student/perfil/editar` | Query | `GSI1PK = SCHOOLS` | GSI1 |
| 7 | Estudiantes de un colegio (+ total y score promedio) | `colegio/perfil`, `colegio/estudiantes`, dashboard | Query | `GSI1PK = SCHOOL#id`, `GSI1SK` empieza con `STUDENT#` | GSI1 |

**Ningún patrón usa `Scan`.** Los filtros de `colegio/estudiantes` (alto o bajo score) se aplican sobre el resultado del patrón 7: son los estudiantes de un solo colegio.

## Consumidores internos

- El servicio `habilidades` consulta `GET /perfiles/me` reenviando el access token del request original. Usa el `colegioId` del perfil del estudiante al declarar y el del perfil del usuario colegio al listar o revisar pendientes.
- `habilidades` no lee directamente `USER#<sub> / PROFILE` con `GetItem`; de ese modo, el servicio `perfiles` conserva la propiedad de sus claves y reglas.

## Reglas del dominio

- `readinessScore` y `profileViews` **no se editan por el usuario**: el patrón 3 los ignora.
- El **registro público solo crea perfiles de `estudiante`**. Los perfiles de `colegio` y `empresa` los crea el equipo por consola o script (la plataforma no tiene un rol administrador).
- Si un estudiante cambia de colegio, se actualizan `colegioId` y `GSI1PK` en el mismo `UpdateItem`. El colegio debe existir.
- Al editar un perfil se escriben **solo los campos enviados y validados**, para no pisar un `readinessScore` que otro proceso actualice al mismo tiempo (*lost update*).
- Al editar la configuración de un colegio (`PutItem`), el adaptador **vuelve a escribir `GSI1PK = SCHOOLS`**; si no, el colegio desaparecería del listado.
- El registro hace dos pasos sin transacción entre ellos (agregar al grupo en Cognito y crear el perfil en DynamoDB). Ambos son **idempotentes**, así que reintentar después de una falla deja todo consistente.
- Las **especialidades son solo las oficiales del Mineduc** (listado TP de 3° y 4° medio: 15 sectores, 35 especialidades y 17 menciones; Bases Curriculares del Decreto 452 de 2013 más Mecánica de Mantenimiento de Aeronaves). El colegio elige de esa lista las que imparte, y el estudiante elige la suya de la lista de su colegio. La lista está en `services/perfiles/src/domain/especialidades.mjs`.
- El access token de Cognito no trae el `email`: el perfil lo guarda solo si viene en el token.

## Pendientes para la fase 2

| Pendiente | Diseño propuesto |
|---|---|
| Buscar talento (empresa: por especialidad, año, score y habilidad) | GSI por especialidad + filtros. Un buscador como OpenSearch queda como diseño (costo por hora) |
| Dashboard del colegio con datos de varios servicios | Patrón BFF / API Composition |
| Cálculo del `readinessScore` | Se actualiza escuchando eventos (por ejemplo, `HabilidadValidada`) |
| Preferencias personales del usuario | `USER#id / PREFS`, que tiene prioridad sobre la configuración del colegio |
| Lectura de la configuración del colegio | Patrón Cache-Aside (F2-16) |
| Rol administrador | Grupo `admin` en Cognito + aprobación de colegios y empresas (diseño de seguridad, F2-06) |
