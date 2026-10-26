# Despliegue canario - Unidad II

El canario usa versiones publicadas de la función `postulaciones` y el alias ponderado
`live`. La ruta `GET /oportunidades` del HTTP API apunta al ARN del alias y conserva el
autorizador JWT de Cognito. Las respuestas incluyen `X-App-Version`, lo que permite
separar las mediciones de la versión estable y la candidata.

## Preparación del stage

Desplegar primero la infraestructura y el servicio desde la rama correspondiente:

```powershell
cd infra/shared
npx serverless deploy --stage rol2
cd ../../services/postulaciones
npm ci
npx serverless deploy --stage rol2
cd ../..
```

Crear el alias `live`, su integración, la ruta protegida y el permiso de invocación:

```powershell
& "C:\Program Files\Git\bin\bash.exe" scripts/canario/canario-servicio.sh rol2
```

El script es idempotente. Si el alias ya existe, conserva su versión estable y repara
la integración y la ruta sin cambiar los pesos del canario.

## Usuario y token de prueba

```powershell
$env:CEIBBO_TEST_PASSWORD = "<password-temporal>"
& "C:\Program Files\Git\bin\bash.exe" scripts/aws/crear-usuarios-prueba.sh rol2
$env:TOKEN = (& "C:\Program Files\Git\bin\bash.exe" scripts/aws/token.sh rol2 estudiante@ceibbo.cl).Trim()

$api = aws cloudformation describe-stacks `
  --stack-name ceibbo-shared-rol2 `
  --query "Stacks[0].Outputs[?OutputKey=='HttpApiUrl'].OutputValue | [0]" `
  --output text
$env:URL = "$api/oportunidades"
```

Sin `TOKEN`, o con uno inválido, la API debe responder `401` y la Lambda no debe ser
invocada.

## Activar y medir el canario

El primer uso de `canario-servicio.sh` crea la versión estable. Después de desplegar
una modificación candidata, publicar la nueva versión y enviarle 10 % del tráfico:

```powershell
.\scripts\canario\deploy.ps1 `
  -FunctionName ceibbo-postulaciones-rol2-postulaciones `
  -Alias live `
  -Weight 0.10

$env:TOTAL = "100"
$env:CONCURRENCIA = "10"
node scripts/canario/generar_carga.js
```

La salida agrupa los estados HTTP y las respuestas por `X-App-Version`, e informa el
porcentaje de errores y el p95 observado.

Si la candidata cumple los umbrales:

```powershell
.\scripts\canario\promote.ps1 `
  -FunctionName ceibbo-postulaciones-rol2-postulaciones `
  -Alias live
```

Si la candidata empeora:

```powershell
.\scripts\canario\rollback.ps1 `
  -FunctionName ceibbo-postulaciones-rol2-postulaciones `
  -Alias live
```

## Criterios de decisión

- Duración mínima: 10 minutos y al menos 100 invocaciones.
- Promover si los errores son menores a 1 % y el p95 no aumenta más de 20 %.
- Revertir si los errores son al menos 1 %, el p95 aumenta más de 20 % o aparecen
  fallos funcionales.

Registrar fecha, versiones, invocaciones, tasa de error, p95 y decisión. La
automatización de alarmas y CI/CD corresponde a la Unidad III.
