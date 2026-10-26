param(
  [Parameter(Mandatory = $true)][string]$FunctionName,
  [string]$Alias = 'demo'
)

$ErrorActionPreference = 'Stop'
$current = aws lambda get-alias --function-name $FunctionName --name $Alias | ConvertFrom-Json
$stableVersion = [string]$current.FunctionVersion
aws lambda update-alias --function-name $FunctionName --name $Alias --function-version $stableVersion --routing-config 'AdditionalVersionWeights={}' | Out-Host
Write-Host "Rollback completado: $Alias vuelve 100% a v$stableVersion."
