# Despliegue canario - Unidad II

El laboratorio usa versiones publicadas de AWS Lambda y un alias ponderado. El primer despliegue crea el alias estable; el siguiente envía 10 % del tráfico a la versión candidata.

## Procedimiento

```powershell
aws sts get-caller-identity
.\scripts\canario\deploy.ps1 -FunctionName ceibbo-health-demo-health -Alias demo -Weight 0.10

# Generar carga sobre el alias y observar errores/latencia en CloudWatch.
aws lambda invoke --function-name ceibbo-health-demo-health --qualifier demo respuesta.json

# Si cumple los umbrales:
.\scripts\canario\promote.ps1 -FunctionName ceibbo-health-demo-health -Alias demo

# Si empeora:
.\scripts\canario\rollback.ps1 -FunctionName ceibbo-health-demo-health -Alias demo
```

## Criterios de decisión

- Duración mínima: 10 minutos y al menos 100 invocaciones.
- Promover si errores < 1 % y p95 no aumenta más de 20 % frente a la estable.
- Revertir si errores >= 1 %, p95 aumenta más de 20 % o aparecen fallos funcionales.

Registrar aquí fecha, versiones, cantidad de invocaciones, tasa de error, p95 y decisión. La automatización de alarmas y CI/CD corresponde a la Unidad III y queda fuera de este alcance.
