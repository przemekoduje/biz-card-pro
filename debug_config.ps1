$env:CI = "1"
npx expo config *>&1 | Out-File -Encoding utf8 debug_output.txt
if ($LASTEXITCODE -ne 0) {
    "Exited with code $LASTEXITCODE" | Out-File -Append -Encoding utf8 debug_output.txt
}
