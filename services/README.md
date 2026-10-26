# Servicios de Ceibbo

Cada dominio es un servicio independiente, con su propio `serverless.yml`, su propio stack de CloudFormation y sus propias pruebas. Todos usan los recursos compartidos de `infra/shared` (tabla, colas, Cognito, HTTP API y autorizador), que leen desde sus outputs.

`health` es la **plantilla**: muestra la estructura hexagonal que siguen todos los servicios.

## 1. Crear un servicio nuevo copiando `health`

```bash
git checkout develop && git pull
git checkout -b feature/<ID>-<servicio>
cp -r services/health services/<servicio>
rm -rf services/<servicio>/node_modules services/<servicio>/.serverless
```

Después, en `services/<servicio>/`:

1. `package.json`: cambiar `name` a `ceibbo-<servicio>` y la `description`.
2. `serverless.yml`: cambiar `service: ceibbo-<servicio>`, el nombre de la función y las rutas (`events`). Las rutas que necesiten usuario llevan el bloque `authorizer` (ver `/health/privado`).
3. Reemplazar el código de ejemplo siguiendo el orden de adentro hacia afuera:
   1. `src/domain/`: entidades y reglas del negocio (si el servicio las necesita).
   2. `src/ports/`: contratos que necesita el caso de uso. Cada puerto exporta la lista de sus métodos (`METODOS_...`) y se revisa con `comprobarPuerto`.
   3. `src/application/`: casos de uso. Reciben sus dependencias como parámetro (`{ repositorio, publicador }`) y **no importan nada de AWS**.
   4. `test/`: pruebas unitarias de los casos de uso con dobles de prueba (repositorios falsos). Correr `npm test`.
   5. `src/adapters/out/`: implementación de los puertos con AWS (DynamoDB, SQS).
   6. `src/adapters/in/http.mjs`: el handler; arma el caso de uso con los adaptadores reales y traduce el resultado a HTTP.
4. `npm install` y `npm test`.

## 2. Desplegar en la cuenta propia

Requisitos: Node 22 (`nvm use 22`), Serverless Framework v4 y las credenciales del Learner Lab vigentes (`aws sts get-caller-identity`).

**Primero la infraestructura compartida** (una vez por cuenta, o cuando cambie):

```bash
cd infra/shared
serverless deploy --stage <rol1|rol2|rol3>
serverless info --verbose --stage <rol1|rol2|rol3>   # muestra los outputs
```

**Después el servicio**, con el mismo stage:

```bash
cd services/<servicio>
npm install
npm test
serverless deploy --stage <rol1|rol2|rol3>
```

Si el servicio se despliega antes que `infra/shared`, falla con un error de que no encuentra el stack `ceibbo-shared-<stage>`.

**Probar `health`:**

```bash
curl -i <HttpApiUrl>/health            # 200 {"estado":"ok",...}
curl -i <HttpApiUrl>/health/privado    # 401 sin token
serverless logs -f health --stage <stage>
```

El stage `demo` solo se despliega desde `main`, en los releases (Rol 1).

## 3. Usuarios y tokens de prueba

Los scripts de B1-17 leen los IDs desde los outputs del stack y no guardan contraseñas en Git:

```bash
export CEIBBO_TEST_PASSWORD='una-clave-temporal-segura'
bash scripts/aws/crear-usuarios-prueba.sh rol2
TOKEN=$(bash scripts/aws/token.sh rol2 estudiante@ceibbo.cl)
curl -i -H "Authorization: Bearer $TOKEN" <HttpApiUrl>/health/privado
```

El primer script crea o actualiza `estudiante@ceibbo.cl`, `empresa@ceibbo.cl` y `colegio@ceibbo.cl`, los agrega a sus grupos y deja sus perfiles de prueba en DynamoDB. El estudiante y el usuario colegio quedan asociados a `school-1`, lo que permite probar la autorización del servicio habilidades. `ALLOW_USER_PASSWORD_AUTH` se usa solo en stages de desarrollo.

## 4. Convenciones

**Carpetas de cada servicio:**

```
services/<servicio>/
├── package.json          "type": "module", scripts test y test:integracion
├── serverless.yml
├── src/
│   ├── domain/           entidades y reglas (sin AWS)
│   ├── ports/            contratos (METODOS_... + comprobarPuerto)
│   ├── application/      casos de uso (sin AWS ni HTTP)
│   └── adapters/
│       ├── in/http.mjs   handler de Lambda
│       └── out/          DynamoDB, SQS, Cognito
└── test/
    ├── *.test.mjs        pruebas unitarias (npm test)
    └── integracion/      pruebas contra DynamoDB Local (npm run test:integracion)
```

**Nombres:**

| Qué | Convención | Ejemplo |
|---|---|---|
| Servicio (Serverless y npm) | `ceibbo-<servicio>` | `ceibbo-postulaciones` |
| Archivos | JavaScript ESM, extensión `.mjs` (decisión D-02) | `verificarSalud.mjs` |
| Casos de uso | verbo en infinitivo, camelCase | `crearPostulacion.mjs` |
| Puertos | sustantivo en PascalCase | `RepositorioPostulaciones.mjs` |
| Adaptadores de salida | tecnología + puerto | `dynamoRepositorioPostulaciones.mjs`, `sqsPublicadorEventos.mjs` |
| Claves en DynamoDB | `TIPO#id` en mayúsculas | `USER#<sub>`, `SCHOOL#<id>` |
| Ramas | `feature/<ID>-<descripción>` desde `develop` | `feature/B2-04-postulaciones` |
| Commits | Conventional Commits con alcance | `feat(postulaciones): ...` |

**Configuración del `serverless.yml`:** `runtime: nodejs22.x`, `memorySize: 256`, rol `arn:aws:iam::${aws:accountId}:role/LabRole`, el API compartido con `httpApi.id: ${cf:ceibbo-shared-${sls:stage}.HttpApiId}` y los nombres de recursos con `${cf:ceibbo-shared-${sls:stage}.<Output>}`. Nunca escribir Ids ni nombres de recursos a mano.

**Outputs disponibles de `infra/shared`:** `TableName`, `BucketName`, `EventsQueueUrl`, `EventsQueueArn`, `UserPoolId`, `UserPoolClientId`, `HttpApiId`, `HttpApiUrl` y `AuthorizerId`.
