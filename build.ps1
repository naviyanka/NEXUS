# NEXUS Deployment Builder
Write-Host "Building NEXUS Gateway..."
dotnet publish src/Nexus.Gateway/Nexus.Gateway.csproj -c Release -r win-x64 --self-contained false

Write-Host "Building NEXUS Frontend..."
Push-Location src/Nexus.Frontend
npm install
npm run build
Pop-Location

Write-Host "Ready for InnoSetup Compiler."
