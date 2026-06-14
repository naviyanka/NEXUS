#!/bin/bash
sed -i 's/<PackageReference Include="Microsoft.AspNetCore.SignalR" Version="8.0.0" \/>//g' src/Nexus.Gateway/Nexus.Gateway.csproj
