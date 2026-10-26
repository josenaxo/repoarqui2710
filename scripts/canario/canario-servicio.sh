#!/usr/bin/env bash
set -euo pipefail

stage="${1:-}"
region="${AWS_REGION:-us-east-1}"
alias_name="live"

if [[ -z "$stage" ]]; then
  echo "Uso: $0 <stage>" >&2
  exit 2
fi

if [[ ! "$stage" =~ ^[a-zA-Z0-9_-]+$ ]]; then
  echo "El stage solo puede contener letras, numeros, guion y guion bajo." >&2
  exit 2
fi

for command in aws grep; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Falta el comando requerido: $command" >&2
    exit 1
  fi
done

stack="ceibbo-shared-${stage}"
function_name="ceibbo-postulaciones-${stage}-postulaciones"

stack_output() {
  local output_key="$1"
  aws cloudformation describe-stacks \
    --stack-name "$stack" \
    --region "$region" \
    --query "Stacks[0].Outputs[?OutputKey=='${output_key}'].OutputValue | [0]" \
    --output text
}

require_value() {
  local name="$1"
  local value="$2"
  if [[ -z "$value" || "$value" == "None" ]]; then
    echo "No se encontro $name en los outputs de $stack." >&2
    exit 1
  fi
}

echo "Verificando credenciales AWS..."
account_id=$(aws sts get-caller-identity \
  --region "$region" \
  --query Account \
  --output text)

api_id=$(stack_output HttpApiId)
api_url=$(stack_output HttpApiUrl)
authorizer_id=$(stack_output AuthorizerId)

require_value HttpApiId "$api_id"
require_value HttpApiUrl "$api_url"
require_value AuthorizerId "$authorizer_id"

aws lambda get-function \
  --function-name "$function_name" \
  --region "$region" >/dev/null

if aws lambda get-alias \
  --function-name "$function_name" \
  --name "$alias_name" \
  --region "$region" >/dev/null 2>&1; then
  stable_version=$(aws lambda get-alias \
    --function-name "$function_name" \
    --name "$alias_name" \
    --region "$region" \
    --query FunctionVersion \
    --output text)
  echo "El alias $alias_name ya existe en la version $stable_version; se conserva sin cambios."
else
  stable_version=$(aws lambda publish-version \
    --function-name "$function_name" \
    --region "$region" \
    --description "Version estable inicial del canario ${stage}" \
    --query Version \
    --output text)

  aws lambda create-alias \
    --function-name "$function_name" \
    --name "$alias_name" \
    --function-version "$stable_version" \
    --description "Version estable invocada por API Gateway" \
    --region "$region" >/dev/null

  echo "Alias $alias_name creado en la version $stable_version."
fi

alias_arn=$(aws lambda get-alias \
  --function-name "$function_name" \
  --name "$alias_name" \
  --region "$region" \
  --query AliasArn \
  --output text)

integration_id=$(aws apigatewayv2 get-integrations \
  --api-id "$api_id" \
  --region "$region" \
  --query "Items[?IntegrationUri=='${alias_arn}'].IntegrationId | [0]" \
  --output text)

if [[ -z "$integration_id" || "$integration_id" == "None" ]]; then
  integration_id=$(aws apigatewayv2 create-integration \
    --api-id "$api_id" \
    --integration-type AWS_PROXY \
    --integration-method POST \
    --integration-uri "$alias_arn" \
    --payload-format-version 2.0 \
    --region "$region" \
    --query IntegrationId \
    --output text)
  echo "Integracion $integration_id creada hacia $alias_arn."
else
  echo "Integracion $integration_id hacia el alias ya existe."
fi

route_id=$(aws apigatewayv2 get-routes \
  --api-id "$api_id" \
  --region "$region" \
  --query "Items[?RouteKey=='GET /oportunidades'].RouteId | [0]" \
  --output text)

if [[ -z "$route_id" || "$route_id" == "None" ]]; then
  route_id=$(aws apigatewayv2 create-route \
    --api-id "$api_id" \
    --route-key "GET /oportunidades" \
    --target "integrations/${integration_id}" \
    --authorization-type JWT \
    --authorizer-id "$authorizer_id" \
    --region "$region" \
    --query RouteId \
    --output text)
  echo "Ruta protegida $route_id creada."
else
  aws apigatewayv2 update-route \
    --api-id "$api_id" \
    --route-id "$route_id" \
    --target "integrations/${integration_id}" \
    --authorization-type JWT \
    --authorizer-id "$authorizer_id" \
    --region "$region" >/dev/null
  echo "Ruta protegida $route_id actualizada."
fi

statement_id="apigateway-${stage}-oportunidades-live"
policy=$(aws lambda get-policy \
  --function-name "$function_name" \
  --qualifier "$alias_name" \
  --region "$region" \
  --query Policy \
  --output text 2>/dev/null || true)

if grep -Eq "\"Sid\"[[:space:]]*:[[:space:]]*\"${statement_id}\"" <<<"$policy"; then
  echo "El permiso de API Gateway sobre el alias ya existe."
else
  aws lambda add-permission \
    --function-name "$function_name" \
    --qualifier "$alias_name" \
    --statement-id "$statement_id" \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:${region}:${account_id}:${api_id}/*/GET/oportunidades" \
    --region "$region" >/dev/null
  echo "Permiso de API Gateway agregado sobre el alias."
fi

echo
echo "Canario configurado correctamente."
echo "Funcion: $function_name"
echo "Alias: $alias_name -> version $stable_version"
echo "Ruta JWT: GET ${api_url}/oportunidades"
