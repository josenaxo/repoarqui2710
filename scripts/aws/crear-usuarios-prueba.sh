#!/usr/bin/env bash
set -euo pipefail

stage="${1:-}"
if [[ -z "$stage" ]]; then
  echo "Uso: CEIBBO_TEST_PASSWORD='<password>' $0 <stage>" >&2
  exit 2
fi
if [[ -z "${CEIBBO_TEST_PASSWORD:-}" ]]; then
  echo "Falta CEIBBO_TEST_PASSWORD." >&2
  exit 2
fi

stack="ceibbo-shared-${stage}"
pool_id=$(aws cloudformation describe-stacks \
  --stack-name "$stack" \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue | [0]' \
  --output text)
table_name=$(aws cloudformation describe-stacks \
  --stack-name "$stack" \
  --query 'Stacks[0].Outputs[?OutputKey==`TableName`].OutputValue | [0]' \
  --output text)

if [[ -z "$pool_id" || "$pool_id" == "None" || -z "$table_name" || "$table_name" == "None" ]]; then
  echo "No se encontraron UserPoolId y TableName en $stack." >&2
  exit 1
fi

crear_usuario() {
  local correo="$1"
  local grupo="$2"

  if ! aws cognito-idp admin-get-user --user-pool-id "$pool_id" --username "$correo" >/dev/null 2>&1; then
    aws cognito-idp admin-create-user \
      --user-pool-id "$pool_id" \
      --username "$correo" \
      --user-attributes Name=email,Value="$correo" Name=email_verified,Value=true \
      --message-action SUPPRESS >/dev/null
  fi

  aws cognito-idp admin-set-user-password \
    --user-pool-id "$pool_id" \
    --username "$correo" \
    --password "$CEIBBO_TEST_PASSWORD" \
    --permanent

  aws cognito-idp admin-add-user-to-group \
    --user-pool-id "$pool_id" \
    --username "$correo" \
    --group-name "$grupo"

  echo "OK: $correo -> $grupo"
}

crear_usuario 'estudiante@ceibbo.cl' estudiante
crear_usuario 'empresa@ceibbo.cl' empresa
crear_usuario 'colegio@ceibbo.cl' colegio

obtener_sub() {
  aws cognito-idp admin-get-user \
    --user-pool-id "$pool_id" \
    --username "$1" \
    --query 'UserAttributes[?Name==`sub`].Value | [0]' \
    --output text
}

estudiante_sub=$(obtener_sub 'estudiante@ceibbo.cl')
empresa_sub=$(obtener_sub 'empresa@ceibbo.cl')
colegio_sub=$(obtener_sub 'colegio@ceibbo.cl')

# GET /perfiles/me necesita estos perfiles. Los PutItem son idempotentes para los usuarios de prueba.
aws dynamodb put-item --table-name "$table_name" --item "{
  \"PK\": {\"S\": \"SCHOOL#school-1\"},
  \"SK\": {\"S\": \"CONFIG\"},
  \"GSI1PK\": {\"S\": \"SCHOOLS\"},
  \"GSI1SK\": {\"S\": \"SCHOOL#school-1\"},
  \"nombre\": {\"S\": \"Colegio de prueba\"}
}"

aws dynamodb put-item --table-name "$table_name" --item "{
  \"PK\": {\"S\": \"USER#${estudiante_sub}\"},
  \"SK\": {\"S\": \"PROFILE\"},
  \"GSI1PK\": {\"S\": \"SCHOOL#school-1\"},
  \"GSI1SK\": {\"S\": \"STUDENT#${estudiante_sub}\"},
  \"userId\": {\"S\": \"${estudiante_sub}\"},
  \"tipo\": {\"S\": \"estudiante\"},
  \"colegioId\": {\"S\": \"school-1\"},
  \"nombre\": {\"S\": \"Estudiante\"},
  \"apellido\": {\"S\": \"Prueba\"},
  \"readinessScore\": {\"N\": \"0\"},
  \"profileViews\": {\"N\": \"0\"}
}"

aws dynamodb put-item --table-name "$table_name" --item "{
  \"PK\": {\"S\": \"USER#${colegio_sub}\"},
  \"SK\": {\"S\": \"PROFILE\"},
  \"userId\": {\"S\": \"${colegio_sub}\"},
  \"tipo\": {\"S\": \"colegio\"},
  \"colegioId\": {\"S\": \"school-1\"},
  \"email\": {\"S\": \"colegio@ceibbo.cl\"}
}"

aws dynamodb put-item --table-name "$table_name" --item "{
  \"PK\": {\"S\": \"USER#${empresa_sub}\"},
  \"SK\": {\"S\": \"PROFILE\"},
  \"userId\": {\"S\": \"${empresa_sub}\"},
  \"tipo\": {\"S\": \"empresa\"},
  \"nombre\": {\"S\": \"Empresa de prueba\"},
  \"email\": {\"S\": \"empresa@ceibbo.cl\"}
}"

echo "OK: perfiles de prueba creados en $table_name"
