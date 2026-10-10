# Makes the pair of keys push notifications need (VAPID keys). Run it once, from anywhere:
#   powershell -ExecutionPolicy Bypass -File sitstart\supabase\functions\make-push-keys.ps1
# It puts the PUBLIC key into CONFIG.vapidKey in sitstart\js\core.js (fine to commit) and shows both keys, so you can
# paste them into Supabase (Edge Functions -> Secrets; SETUP.md step 9). The PRIVATE key is a secret: it only goes
# into Supabase, never into the site or the repo. Nothing here saves it.
# Running it again makes a new pair, and every device has to turn notifications on again, so it stops if a key is
# already set. Use -Force to replace it anyway.
param([switch]$Force)
$ErrorActionPreference = 'Stop'

$core = Join-Path $PSScriptRoot '..\..\js\core.js'
$utf8 = New-Object System.Text.UTF8Encoding($false)
$text = [IO.File]::ReadAllText($core, $utf8)
$slot = [regex]'vapidKey: "([^"]*)"'
$now = $slot.Match($text)
if (-not $now.Success) { throw "Couldn't find vapidKey in $core." }
if ($now.Groups[1].Value -and -not $Force) {
  Write-Host "core.js already has a push key. Run again with -Force to replace it (every device must then turn notifications on again)."
  exit 1
}

function B64Url([byte[]]$b) { [Convert]::ToBase64String($b).TrimEnd('=').Replace('+', '-').Replace('/', '_') }
$ec = [System.Security.Cryptography.ECDsa]::Create([System.Security.Cryptography.ECCurve+NamedCurves]::nistP256)
$k = $ec.ExportParameters($true)
$public = B64Url ([byte[]](, 4) + $k.Q.X + $k.Q.Y)
$private = B64Url $k.D

[IO.File]::WriteAllText($core, $slot.Replace($text, "vapidKey: `"$public`"", 1), $utf8)

Write-Host ''
Write-Host 'Done. The public key is now in sitstart\js\core.js.'
Write-Host 'Add these two secrets in Supabase (Edge Functions -> Secrets):'
Write-Host ''
Write-Host "  VAPID_PUBLIC_KEY   $public"
Write-Host "  VAPID_PRIVATE_KEY  $private"
Write-Host ''
Write-Host 'Keep the private key out of the site and the repo. Close this window once both are saved in Supabase.'
