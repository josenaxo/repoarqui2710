param(
  [Parameter(Mandatory = $true)][string]$FunctionName,
  [string]$Alias = 'demo'
)

$ErrorActionPreference = 'Stop'
$current = aws lambda get-alias --function-name $FunctionName --name $Alias | ConvertFrom-Json
$weights = $current.RoutingConfig.AdditionalVersionWeights.PSObject.Properties
if ($weights.Count -ne 1) { throw 'El alias no tiene exactamente una versión canaria.' }
$canaryVersion = [string]$weights[0].Name
aws lambda update-alias --function-name $FunctionName --name $Alias --function-version $canaryVersion --routing-config 'AdditionalVersionWeights={}' | Out-Host
Write-Host "Canario promovido: $Alias apunta 100% a v$canaryVersion."
