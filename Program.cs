using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.AspNetCore.Http.Json;

var builder = WebApplication.CreateBuilder(new WebApplicationOptions
{
    Args = args,
    ContentRootPath = Directory.GetCurrentDirectory(),
    WebRootPath = Directory.GetCurrentDirectory()
});
builder.Services.Configure<JsonOptions>(options => options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase);
var app = builder.Build();
var dataPath = Path.Combine(app.Environment.ContentRootPath, "data.json");
var dataLock = new object();
var data = LoadData(dataPath);
var activeTokens = new Dictionary<string, string>();

app.UseDefaultFiles();
app.UseStaticFiles();

app.MapPost("/api/auth/register", (RegisterRequest request) =>
{
    if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Email) || request.Password.Length < 6)
        return Results.BadRequest(new { message = "Попълнете всички полета. Паролата трябва да е поне 6 символа." });

    lock (dataLock)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        if (data.Users.Any(user => user.Email == email))
            return Results.Conflict(new { message = "Вече има профил с този имейл адрес." });

        var user = new User
        {
            Id = Guid.NewGuid().ToString("N"),
            Name = request.Name.Trim(),
            Email = email,
            Password = HashPassword(request.Password),
            Role = request.Role is "professional" or "company" ? request.Role : "client",
            CreatedAt = DateTimeOffset.UtcNow
        };
        data.Users.Add(user);
        SaveData(dataPath, data);
        var token = CreateToken();
        activeTokens[token] = user.Id;
        return Results.Ok(new { token, user = new { user.Name, user.Email, user.Role } });
    }
});

app.MapPost("/api/auth/login", (LoginRequest request) =>
{
    lock (dataLock)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var user = data.Users.FirstOrDefault(candidate => candidate.Email == email);
        if (user is null || !VerifyPassword(request.Password, user.Password))
            return Results.Unauthorized();

        var token = CreateToken();
        activeTokens[token] = user.Id;
        return Results.Ok(new { token, user = new { user.Name, user.Email, user.Role } });
    }
});

app.MapPost("/api/auth/logout", (HttpRequest httpRequest) =>
{
    var authorization = httpRequest.Headers.Authorization.ToString();
    var token = authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)
        ? authorization["Bearer ".Length..].Trim()
        : "";
    if (token.Length == 0) return Results.Unauthorized();
    lock (dataLock)
    {
        activeTokens.Remove(token);
    }
    return Results.Ok();
});

app.MapPut("/api/account", (HttpRequest httpRequest, AccountUpdateRequest request) =>
{
    var userId = GetAuthorizedUserId(httpRequest, activeTokens, dataLock);
    if (userId is null) return Results.Unauthorized();
    if (string.IsNullOrWhiteSpace(request.Name) ||
        request.Name.Trim().Length > 100 ||
        string.IsNullOrWhiteSpace(request.Email) ||
        request.Email.Trim().Length > 254 ||
        !request.Email.Contains('@'))
        return Results.BadRequest(new { message = "Въведете валидно име и имейл адрес." });

    lock (dataLock)
    {
        var user = data.Users.FirstOrDefault(candidate => candidate.Id == userId);
        if (user is null) return Results.NotFound(new { message = "Профилът не е намерен." });

        var email = request.Email.Trim().ToLowerInvariant();
        if (data.Users.Any(candidate => candidate.Id != userId && candidate.Email == email))
            return Results.Conflict(new { message = "Вече има профил с този имейл адрес." });

        user.Name = request.Name.Trim();
        user.Email = email;
        SaveData(dataPath, data);
        return Results.Ok(new { user = new { user.Name, user.Email, user.Role } });
    }
});

app.MapDelete("/api/account", (HttpRequest httpRequest) =>
{
    var userId = GetAuthorizedUserId(httpRequest, activeTokens, dataLock);
    if (userId is null) return Results.Unauthorized();

    lock (dataLock)
    {
        var user = data.Users.FirstOrDefault(candidate => candidate.Id == userId);
        if (user is null) return Results.NotFound(new { message = "Профилът не е намерен." });

        data.Users.Remove(user);
        data.Projects.RemoveAll(project => project.UserId == userId);
        data.Listings.RemoveAll(listing => listing.UserId == userId);
        foreach (var token in activeTokens.Where(entry => entry.Value == userId).Select(entry => entry.Key).ToList())
            activeTokens.Remove(token);
        SaveData(dataPath, data);
        return Results.Ok(new { message = "Профилът и свързаните с него данни са изтрити." });
    }
});

app.MapGet("/api/account/projects", (HttpRequest httpRequest) =>
{
    var userId = GetAuthorizedUserId(httpRequest, activeTokens, dataLock);
    if (userId is null) return Results.Unauthorized();
    lock (dataLock)
    {
        var projects = data.Projects.Where(project => project.UserId == userId)
            .OrderByDescending(project => project.CreatedAt)
            .Select(project => new { project.Id, project.Name, project.Phone, project.Description, project.CreatedAt })
            .ToList();
        return Results.Ok(projects);
    }
});

app.MapGet("/api/account/listings", (HttpRequest httpRequest) =>
{
    var userId = GetAuthorizedUserId(httpRequest, activeTokens, dataLock);
    if (userId is null) return Results.Unauthorized();
    lock (dataLock)
    {
        var listings = data.Listings.Where(listing => listing.UserId == userId)
            .OrderByDescending(listing => listing.CreatedAt)
            .Select(listing => new { listing.Id, listing.Service, listing.City, listing.Description, listing.CreatedAt })
            .ToList();
        return Results.Ok(listings);
    }
});

app.MapPost("/api/account/listings", (HttpRequest httpRequest, ListingRequest request) =>
{
    var userId = GetAuthorizedUserId(httpRequest, activeTokens, dataLock);
    if (userId is null) return Results.Unauthorized();
    if (string.IsNullOrWhiteSpace(request.Service) ||
        string.IsNullOrWhiteSpace(request.City) ||
        string.IsNullOrWhiteSpace(request.Description))
        return Results.BadRequest(new { message = "Попълнете услугата, населеното място и описанието." });

    lock (dataLock)
    {
        var user = data.Users.FirstOrDefault(candidate => candidate.Id == userId);
        if (user is null) return Results.NotFound(new { message = "Профилът не е намерен." });
        if (user.Role is not ("professional" or "company"))
            return Results.Forbid();

        var listing = new Listing
        {
            Id = Guid.NewGuid().ToString("N"),
            UserId = userId,
            Service = request.Service.Trim(),
            City = request.City.Trim(),
            Description = request.Description.Trim(),
            CreatedAt = DateTimeOffset.UtcNow
        };
        data.Listings.Add(listing);
        SaveData(dataPath, data);
        return Results.Ok(new { listing.Id, listing.Service, listing.City, listing.Description, listing.CreatedAt });
    }
});

app.MapPost("/api/projects", (HttpRequest httpRequest, ProjectRequest request) =>
{
    var userId = GetAuthorizedUserId(httpRequest, activeTokens, dataLock);
    if (userId is null) return Results.Unauthorized();

    if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Phone) || string.IsNullOrWhiteSpace(request.Description))
        return Results.BadRequest(new { message = "Попълнете име, телефон и описание на проекта." });

    lock (dataLock)
    {
        data.Projects.Add(new Project
        {
            Id = Guid.NewGuid().ToString("N"),
            UserId = userId,
            Name = request.Name.Trim(),
            Phone = request.Phone.Trim(),
            Description = request.Description.Trim(),
            CreatedAt = DateTimeOffset.UtcNow
        });
        SaveData(dataPath, data);
    }
    return Results.Ok(new { message = "Заявката е изпратена успешно." });
});

app.MapPost("/api/contact", (ContactRequest request) =>
{
    if (string.IsNullOrWhiteSpace(request.Name) ||
        string.IsNullOrWhiteSpace(request.Email) ||
        !request.Email.Contains('@') ||
        string.IsNullOrWhiteSpace(request.Message))
        return Results.BadRequest(new { message = "Попълнете име, валиден имейл и съобщение." });

    lock (dataLock)
    {
        data.Messages.Add(new ContactMessage
        {
            Id = Guid.NewGuid().ToString("N"),
            Name = request.Name.Trim(),
            Email = request.Email.Trim(),
            Topic = request.Topic.Trim(),
            Message = request.Message.Trim(),
            CreatedAt = DateTimeOffset.UtcNow
        });
        SaveData(dataPath, data);
    }
    return Results.Ok(new { message = "Съобщението е изпратено успешно." });
});

app.MapFallbackToFile("index.html");
app.Run("http://localhost:8080");

static string? GetAuthorizedUserId(HttpRequest request, Dictionary<string, string> tokens, object dataLock)
{
    var authorization = request.Headers.Authorization.ToString();
    var token = authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)
        ? authorization["Bearer ".Length..].Trim()
        : "";
    if (token.Length == 0) return null;
    lock (dataLock)
        return tokens.TryGetValue(token, out var userId) ? userId : null;
}

static AppData LoadData(string path)
{
    if (!File.Exists(path)) return new AppData();
    try { return JsonSerializer.Deserialize<AppData>(File.ReadAllText(path)) ?? new AppData(); }
    catch (JsonException) { return new AppData(); }
}

static void SaveData(string path, AppData data) =>
    File.WriteAllText(path, JsonSerializer.Serialize(data, new JsonSerializerOptions { WriteIndented = true }));

static string HashPassword(string password)
{
    var salt = RandomNumberGenerator.GetBytes(16);
    var hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, 120_000, HashAlgorithmName.SHA256, 32);
    return $"{Convert.ToBase64String(salt)}.{Convert.ToBase64String(hash)}";
}

static bool VerifyPassword(string password, string stored)
{
    var parts = stored.Split('.');
    if (parts.Length != 2) return false;
    try
    {
        var salt = Convert.FromBase64String(parts[0]);
        var expected = Convert.FromBase64String(parts[1]);
        var actual = Rfc2898DeriveBytes.Pbkdf2(password, salt, 120_000, HashAlgorithmName.SHA256, expected.Length);
        return CryptographicOperations.FixedTimeEquals(actual, expected);
    }
    catch (FormatException) { return false; }
}

static string CreateToken() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));

record RegisterRequest(string Name, string Email, string Password, string? Role);
record LoginRequest(string Email, string Password);
record AccountUpdateRequest(string Name, string Email);
record ProjectRequest(string Name, string Phone, string Description);
record ListingRequest(string Service, string City, string Description);
record ContactRequest(string Name, string Email, string Topic, string Message);
class AppData { public List<User> Users { get; set; } = []; public List<Project> Projects { get; set; } = []; public List<Listing> Listings { get; set; } = []; public List<ContactMessage> Messages { get; set; } = []; }
class User { public string Id { get; set; } = ""; public string Name { get; set; } = ""; public string Email { get; set; } = ""; public string Password { get; set; } = ""; public string Role { get; set; } = "client"; public DateTimeOffset CreatedAt { get; set; } }
class Project { public string Id { get; set; } = ""; public string UserId { get; set; } = ""; public string Name { get; set; } = ""; public string Phone { get; set; } = ""; public string Description { get; set; } = ""; public DateTimeOffset CreatedAt { get; set; } }
class Listing { public string Id { get; set; } = ""; public string UserId { get; set; } = ""; public string Service { get; set; } = ""; public string City { get; set; } = ""; public string Description { get; set; } = ""; public DateTimeOffset CreatedAt { get; set; } }
class ContactMessage { public string Id { get; set; } = ""; public string Name { get; set; } = ""; public string Email { get; set; } = ""; public string Topic { get; set; } = ""; public string Message { get; set; } = ""; public DateTimeOffset CreatedAt { get; set; } }
