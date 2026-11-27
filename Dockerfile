FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY . .
RUN dotnet publish StroiHub.csproj -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
ENV DatabaseProvider=Sqlite
ENV ConnectionStrings__StroiHub="Data Source=/tmp/stroihub.db"
COPY --from=build /app/publish .
EXPOSE 8080
ENTRYPOINT ["sh", "-c", "dotnet StroiHub.dll --urls http://0.0.0.0:${PORT:-8080}"]
