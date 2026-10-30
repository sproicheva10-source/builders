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
var activeTokens = new HashSet<string>();

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
        activeTokens.Add(token);
        return Results.Ok(new { token, user = new { user.Name, user.Email } });
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
        activeTokens.Add(token);
        return Results.Ok(new { token, user = new { user.Name, user.Email } });
    }
});

app.MapPost("/api/projects", (HttpRequest httpRequest, ProjectRequest request) =>
{
    var authorization = httpRequest.Headers.Authorization.ToString();
    var token = authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)
        ? authorization["Bearer ".Length..].Trim()
        : "";
    var authorized = false;
    lock (dataLock)
    {
        authorized = token.Length > 0 && activeTokens.Contains(token);
    }
    if (!authorized)
        return Results.Unauthorized();

    if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Phone) || string.IsNullOrWhiteSpace(request.Description))
        return Results.BadRequest(new { message = "Попълнете име, телефон и описание на проекта." });

    lock (dataLock)
    {
        data.Projects.Add(new Project
        {
            Id = Guid.NewGuid().ToString("N"),
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
record ProjectRequest(string Name, string Phone, string Description);
record ContactRequest(string Name, string Email, string Topic, string Message);
class AppData { public List<User> Users { get; set; } = []; public List<Project> Projects { get; set; } = []; public List<ContactMessage> Messages { get; set; } = []; }
class User { public string Id { get; set; } = ""; public string Name { get; set; } = ""; public string Email { get; set; } = ""; public string Password { get; set; } = ""; public string Role { get; set; } = "client"; public DateTimeOffset CreatedAt { get; set; } }
class Project { public string Id { get; set; } = ""; public string Name { get; set; } = ""; public string Phone { get; set; } = ""; public string Description { get; set; } = ""; public DateTimeOffset CreatedAt { get; set; } }
class ContactMessage { public string Id { get; set; } = ""; public string Name { get; set; } = ""; public string Email { get; set; } = ""; public string Topic { get; set; } = ""; public string Message { get; set; } = ""; public DateTimeOffset CreatedAt { get; set; } }
