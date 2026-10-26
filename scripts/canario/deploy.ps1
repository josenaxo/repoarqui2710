param(
  [Parameter(Mandatory = $true)][string]$FunctionName,
  [string]$Alias = 'demo',
  [ValidateRange(0.01, 0.5)][double]$Weight = 0.10
)

$ErrorActionPreference = 'Stop'
aws sts get-caller-identity | Out-Host

$published = aws lambda publish-version --function-name $FunctionName | ConvertFrom-Json
$newVersion = [string]$published.Version
$current = $null
try { $current = aws lambda get-alias --function-name $FunctionName --name $Alias | ConvertFrom-Json } catch {}

if ($null -eq $current) {
  aws lambda create-alias --function-name $FunctionName --name $Alias --function-version $newVersion --description 'Versión estable inicial' | Out-Host
  Write-Host "Alias $Alias creado en v$newVersion. En el próximo release se podrá repartir tráfico."
  exit 0
}

$stableVersion = [string]$current.FunctionVersion
$routing = "AdditionalVersionWeights={$newVersion=$Weight}"
aws lambda update-alias --function-name $FunctionName --name $Alias --function-version $stableVersion --routing-config $routing | Out-Host
Write-Host "Canario activo: $([math]::Round($Weight * 100))% a v$newVersion y el resto a v$stableVersion."
Write-Host "Ejecuta pruebas con --qualifier $Alias; luego usa promote.ps1 o rollback.ps1."
