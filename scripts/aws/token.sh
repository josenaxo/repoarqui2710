#!/usr/bin/env bash
set -euo pipefail

stage="${1:-}"
usuario="${2:-}"
if [[ -z "$stage" || -z "$usuario" ]]; then
  echo "Uso: CEIBBO_TEST_PASSWORD='<password>' $0 <stage> <usuario>" >&2
  exit 2
fi
if [[ -z "${CEIBBO_TEST_PASSWORD:-}" ]]; then
  echo "Falta CEIBBO_TEST_PASSWORD." >&2
  exit 2
fi

stack="ceibbo-shared-${stage}"
client_id=$(aws cloudformation describe-stacks \
  --stack-name "$stack" \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue | [0]' \
  --output text)

if [[ -z "$client_id" || "$client_id" == "None" ]]; then
  echo "No se encontro UserPoolClientId en $stack." >&2
  exit 1
fi

aws cognito-idp initiate-auth \
  --client-id "$client_id" \
  --auth-flow USER_PASSWORD_AUTH \
  --auth-parameters "USERNAME=${usuario},PASSWORD=${CEIBBO_TEST_PASSWORD}" \
  --query 'AuthenticationResult.AccessToken' \
  --output text
