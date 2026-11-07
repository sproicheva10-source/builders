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

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
app.UseDefaultFiles();
app.UseStaticFiles();

app.MapPost("/api/auth/register", (RegisterRequest request) =>
{
    var isProfessional = request.Role == "professional";
    if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Trim().Length > 100 ||
        string.IsNullOrWhiteSpace(request.Email) || request.Email.Trim().Length > 254 ||
        !System.Net.Mail.MailAddress.TryCreate(request.Email.Trim(), out _) ||
        request.Password is null || request.Password.Length is < 8 or > 128 ||
        string.IsNullOrWhiteSpace(request.Phone) || request.Phone.Trim().Length > 40 ||
        string.IsNullOrWhiteSpace(request.City) || request.City.Trim().Length > 80 ||
        string.IsNullOrWhiteSpace(request.Region) || request.Region.Trim().Length > 100 ||
        !request.TermsAccepted || !request.PrivacyAccepted ||
        !IsValidImageDataUrl(request.ProfilePhoto, 3 * 1024 * 1024) ||
        request.Role is not ("client" or "professional" or "company") ||
        (isProfessional &&
            ((request.AdditionalCities?.Trim().Length ?? 0) > 300 ||
             string.IsNullOrWhiteSpace(request.PrimaryCategory) ||
             request.Categories is not { Count: > 0 and <= 8 } ||
             request.Services is not { Count: > 0 and <= 30 } ||
             !request.Categories.Contains(request.PrimaryCategory) ||
             request.Categories.Any(category => !IsProfessionalCategory(category)) ||
             request.Services.Any(service => string.IsNullOrWhiteSpace(service) || service.Trim().Length > 100 ||
                 !request.Categories.Any(category => IsServiceInCategory(category, service))) ||
             request.Categories.Distinct(StringComparer.Ordinal).Count() != request.Categories.Count ||
             request.Services.Distinct(StringComparer.Ordinal).Count() != request.Services.Count ||
             request.Experience is null or < 0 or > 70 ||
             string.IsNullOrWhiteSpace(request.ProfileDescription) ||
             request.ProfileDescription.Trim().Length is < 20 or > 600 ||
             request.WorkPreference is not ("Самостоятелно" or "С екип") ||
             (request.ProfessionalLink?.Trim().Length ?? 0) > 500 ||
             (!string.IsNullOrWhiteSpace(request.ProfessionalLink) &&
              (!Uri.TryCreate(request.ProfessionalLink, UriKind.Absolute, out var professionalUri) ||
               professionalUri.Scheme is not ("http" or "https"))) ||
             request.PortfolioPhotos is { Count: > 5 } ||
             (request.PortfolioPhotos?.Any(photo => string.IsNullOrEmpty(photo) ||
                 !IsValidImageDataUrl(photo, 3 * 1024 * 1024)) ?? false) ||
             (request.PortfolioPhotos?.Sum(photo => (long)(photo?.Length ?? 0)) ?? 0) > 14 * 1024 * 1024))
        )
        return Results.BadRequest(new { message = "Попълнете валидни данни и парола с 8–128 символа." });

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
            Role = request.Role!,
            Phone = request.Phone?.Trim() ?? "",
            City = request.City?.Trim() ?? "",
            Region = request.Region?.Trim() ?? "",
            AdditionalCities = request.AdditionalCities?.Trim() ?? "",
            PrimaryCategory = request.PrimaryCategory?.Trim() ?? "",
            Categories = request.Categories ?? [],
            Services = request.Services ?? [],
            WorkPreference = request.WorkPreference?.Trim() ?? "",
            ProfessionalLink = request.ProfessionalLink?.Trim() ?? "",
            ProfilePhoto = request.ProfilePhoto ?? "",
            PortfolioPhotos = request.PortfolioPhotos ?? [],
            TermsAcceptedAt = request.TermsAccepted ? DateTimeOffset.UtcNow : null,
            PrivacyAcceptedAt = request.PrivacyAccepted ? DateTimeOffset.UtcNow : null,
            ProfileDescription = request.ProfileDescription?.Trim() ?? "",
            Experience = request.Experience,
            CreatedAt = DateTimeOffset.UtcNow
        };
        data.Users.Add(user);
        SaveData(dataPath, data);
        var token = CreateToken();
        activeTokens[token] = user.Id;
        return Results.Ok(new { token, user = new { user.Name, user.Email, user.Role, user.Phone, user.City } });
    }
});

app.MapGet("/api/account/incoming-requests", (HttpRequest httpRequest) =>
{
    var userId = GetAuthorizedUserId(httpRequest, activeTokens, dataLock);
    if (userId is null) return Results.Unauthorized();
    lock (dataLock)
    {
        var projects = data.Projects.Where(project => project.ProfessionalId == userId)
            .OrderByDescending(project => project.CreatedAt)
            .Select(project => new
            {
                project.Id,
                project.Name,
                project.Phone,
                project.Description,
                project.Service,
                project.City,
                project.PreferredPeriod,
                project.Status,
                project.CreatedAt
            })
            .ToList();
        return Results.Ok(projects);
    }
});

app.MapPatch("/api/account/incoming-requests/{projectId}", (HttpRequest httpRequest, string projectId, RequestStatusUpdate request) =>
{
    var userId = GetAuthorizedUserId(httpRequest, activeTokens, dataLock);
    if (userId is null) return Results.Unauthorized();
    if (request.Status is not ("Прието" or "Отказано" or "В процес на обсъждане" or "Приключено"))
        return Results.BadRequest(new { message = "Избраният статус не е валиден." });
    lock (dataLock)
    {
        var project = data.Projects.FirstOrDefault(candidate => candidate.Id == projectId && candidate.ProfessionalId == userId);
        if (project is null) return Results.NotFound(new { message = "Запитването не е намерено." });
        project.Status = request.Status;
        SaveData(dataPath, data);
        return Results.Ok(new { project.Id, project.Status });
    }
});

app.MapGet("/api/account/portfolio", (HttpRequest httpRequest) =>
{
    var userId = GetAuthorizedUserId(httpRequest, activeTokens, dataLock);
    if (userId is null) return Results.Unauthorized();
    lock (dataLock)
        return Results.Ok(data.PortfolioProjects.Where(project => project.UserId == userId)
            .OrderByDescending(project => project.CreatedAt)
            .Select(project => new { project.Id, project.Title, project.Category, project.Description, project.CreatedAt })
            .ToList());
});

app.MapPost("/api/account/portfolio", (HttpRequest httpRequest, PortfolioRequest request) =>
{
    var userId = GetAuthorizedUserId(httpRequest, activeTokens, dataLock);
    if (userId is null) return Results.Unauthorized();
    if (string.IsNullOrWhiteSpace(request.Title) || request.Title.Trim().Length > 100 ||
        string.IsNullOrWhiteSpace(request.Category) || request.Category.Trim().Length > 100 ||
        string.IsNullOrWhiteSpace(request.Description) || request.Description.Trim().Length > 1000)
        return Results.BadRequest(new { message = "Попълни заглавие, категория и описание на проекта." });
    lock (dataLock)
    {
        var user = data.Users.FirstOrDefault(candidate => candidate.Id == userId);
        if (user is null) return Results.NotFound(new { message = "Профилът не е намерен." });
        if (user.Role is not ("professional" or "company")) return Results.Forbid();
        var project = new PortfolioProject
        {
            Id = Guid.NewGuid().ToString("N"),
            UserId = userId,
            Title = request.Title.Trim(),
            Category = request.Category.Trim(),
            Description = request.Description.Trim(),
            CreatedAt = DateTimeOffset.UtcNow
        };
        data.PortfolioProjects.Add(project);
        SaveData(dataPath, data);
        return Results.Ok(new { project.Id, project.Title, project.Category, project.Description, project.CreatedAt });
    }
});

app.MapDelete("/api/account/portfolio/{projectId}", (HttpRequest httpRequest, string projectId) =>
{
    var userId = GetAuthorizedUserId(httpRequest, activeTokens, dataLock);
    if (userId is null) return Results.Unauthorized();
    lock (dataLock)
    {
        var project = data.PortfolioProjects.FirstOrDefault(candidate => candidate.Id == projectId && candidate.UserId == userId);
        if (project is null) return Results.NotFound(new { message = "Проектът не е намерен." });
        data.PortfolioProjects.Remove(project);
        SaveData(dataPath, data);
        return Results.Ok(new { message = "Проектът е премахнат." });
    }
});

app.MapPost("/api/auth/login", (LoginRequest request) =>
{
    if (string.IsNullOrWhiteSpace(request.Email) || request.Password is null)
        return Results.Unauthorized();
    lock (dataLock)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var user = data.Users.FirstOrDefault(candidate => candidate.Email == email);
        if (user is null || !VerifyPassword(request.Password, user.Password))
            return Results.Unauthorized();

        var token = CreateToken();
        activeTokens[token] = user.Id;
        return Results.Ok(new { token, user = new { user.Name, user.Email, user.Role, user.Phone, user.City } });
    }
});

app.MapPost("/api/auth/forgot-password", async (PasswordResetRequest request, IConfiguration configuration) =>
{
    if (string.IsNullOrWhiteSpace(request.Email) ||
        !System.Net.Mail.MailAddress.TryCreate(request.Email.Trim(), out _))
        return Results.BadRequest(new { message = "Въведи валиден имейл адрес." });

    var smtpHost = configuration["STROIHUB_SMTP_HOST"];
    var smtpFrom = configuration["STROIHUB_SMTP_FROM"];
    var resetBaseUrl = configuration["STROIHUB_PUBLIC_URL"];
    var port = int.TryParse(configuration["STROIHUB_SMTP_PORT"], out var configuredPort) ? configuredPort : 587;
    if (string.IsNullOrWhiteSpace(smtpHost) || string.IsNullOrWhiteSpace(smtpFrom) ||
        port is < 1 or > 65535 ||
        !System.Net.Mail.MailAddress.TryCreate(smtpFrom, out _) ||
        !Uri.TryCreate(resetBaseUrl, UriKind.Absolute, out var publicUri) ||
        (publicUri.Scheme != Uri.UriSchemeHttps && !publicUri.IsLoopback))
        return Results.Problem("Изпращането на имейли не е конфигурирано на сървъра.", statusCode: StatusCodes.Status503ServiceUnavailable);

    User? user;
    string rawToken;
    string tokenHash;
    lock (dataLock)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        user = data.Users.FirstOrDefault(candidate => candidate.Email == email);
        if (user is null) return Results.Ok(new { message = "Ако адресът е свързан с профил, ще получиш инструкции за възстановяване." });
        rawToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        tokenHash = HashResetToken(rawToken);
        user.PasswordResetTokenHash = tokenHash;
        user.PasswordResetExpiresAt = DateTimeOffset.UtcNow.AddHours(1);
        SaveData(dataPath, data);
    }

    var resetLink = $"{publicUri.ToString().TrimEnd('/')}/reset-password.html?token={Uri.EscapeDataString(rawToken)}";
    var message = new System.Net.Mail.MailMessage(smtpFrom, user.Email)
    {
        Subject = "Възстановяване на паролата за StroiHub",
        Body = $"За да зададеш нова парола, отвори този адрес в рамките на един час:\n\n{resetLink}\n\nАко не си поискал възстановяване, игнорирай това съобщение.",
        BodyEncoding = System.Text.Encoding.UTF8,
        SubjectEncoding = System.Text.Encoding.UTF8
    };

    try
    {
        using var smtp = new System.Net.Mail.SmtpClient(smtpHost, port) { EnableSsl = true };
        var smtpUser = configuration["STROIHUB_SMTP_USER"];
        var smtpPassword = configuration["STROIHUB_SMTP_PASSWORD"];
        if (!string.IsNullOrWhiteSpace(smtpUser))
            smtp.Credentials = new System.Net.NetworkCredential(smtpUser, smtpPassword);
        await smtp.SendMailAsync(message);
    }
    catch (System.Net.Mail.SmtpException exception)
    {
        lock (dataLock)
        {
            if (user.PasswordResetTokenHash == tokenHash)
            {
                user.PasswordResetTokenHash = "";
                user.PasswordResetExpiresAt = null;
                SaveData(dataPath, data);
            }
        }
        app.Logger.LogError(exception, "Password reset email could not be sent.");
        return Results.Problem("Не успяхме да изпратим инструкции. Опитай отново по-късно.", statusCode: StatusCodes.Status503ServiceUnavailable);
    }
    finally
    {
        message.Dispose();
    }

    return Results.Ok(new { message = "Ако адресът е свързан с профил, ще получиш инструкции за възстановяване." });
});

app.MapPost("/api/auth/reset-password", (PasswordResetCompletionRequest request) =>
{
    if (string.IsNullOrWhiteSpace(request.Token) || request.Password is null || request.Password.Length is < 8 or > 128)
        return Results.BadRequest(new { message = "Задай парола с 8–128 символа." });

    var tokenHash = HashResetToken(request.Token);
    lock (dataLock)
    {
        var user = data.Users.FirstOrDefault(candidate =>
            candidate.PasswordResetTokenHash == tokenHash &&
            candidate.PasswordResetExpiresAt.HasValue &&
            candidate.PasswordResetExpiresAt.Value > DateTimeOffset.UtcNow);
        if (user is null) return Results.BadRequest(new { message = "Линкът е невалиден или е изтекъл. Поискай нов." });
        user.Password = HashPassword(request.Password);
        user.PasswordResetTokenHash = "";
        user.PasswordResetExpiresAt = null;
        foreach (var token in activeTokens.Where(entry => entry.Value == user.Id).Select(entry => entry.Key).ToList())
            activeTokens.Remove(token);
        SaveData(dataPath, data);
    }
    return Results.Ok(new { message = "Паролата е променена. Влез с новата парола." });
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
        !System.Net.Mail.MailAddress.TryCreate(request.Email.Trim(), out _) ||
        (request.Phone?.Trim().Length ?? 0) > 40 ||
        (request.City?.Trim().Length ?? 0) > 80 ||
        (request.ProfileDescription?.Trim().Length ?? 0) > 600 ||
        (request.Experience is not null && request.Experience is < 0 or > 70))
        return Results.BadRequest(new { message = "Въведете валидни име, имейл, телефон и населено място." });

    lock (dataLock)
    {
        var user = data.Users.FirstOrDefault(candidate => candidate.Id == userId);
        if (user is null) return Results.NotFound(new { message = "Профилът не е намерен." });

        var email = request.Email.Trim().ToLowerInvariant();
        if (data.Users.Any(candidate => candidate.Id != userId && candidate.Email == email))
            return Results.Conflict(new { message = "Вече има профил с този имейл адрес." });

        user.Name = request.Name.Trim();
        user.Email = email;
        if (request.Phone is not null) user.Phone = request.Phone.Trim();
        if (request.City is not null) user.City = request.City.Trim();
        if (request.ProfileDescription is not null) user.ProfileDescription = request.ProfileDescription.Trim();
        if (request.Experience is not null) user.Experience = request.Experience.Value;
        SaveData(dataPath, data);
        return Results.Ok(new { user = new { user.Name, user.Email, user.Role, user.Phone, user.City, user.ProfileDescription, user.Experience } });
    }
});

app.MapGet("/api/professionals", (string? service, string? city) =>
{
    lock (dataLock)
    {
        var profiles = data.Listings
            .Where(listing =>
                (string.IsNullOrWhiteSpace(service) || listing.Service.Equals(service.Trim(), StringComparison.OrdinalIgnoreCase)) &&
                (string.IsNullOrWhiteSpace(city) || listing.City.Contains(city.Trim(), StringComparison.OrdinalIgnoreCase)))
            .Select(listing => new
            {
                listing.UserId,
                listing.Service,
                listing.Title,
                listing.City,
                listing.Description,
                listing.CreatedAt,
                User = data.Users.FirstOrDefault(user => user.Id == listing.UserId)
            })
            .Where(entry => entry.User is not null && entry.User.Role is "professional" or "company")
            .Select(entry => new
            {
                id = entry.UserId,
                name = entry.User!.Name,
                role = entry.User.Role,
                service = entry.Service,
                title = entry.Title,
                city = entry.City,
                description = entry.Description,
                createdAt = entry.CreatedAt
            })
            .ToList();
        return Results.Ok(profiles);
    }
});

app.MapGet("/api/professionals/{userId}", (string userId) =>
{
    lock (dataLock)
    {
        var user = data.Users.FirstOrDefault(candidate => candidate.Id == userId &&
            candidate.Role is "professional" or "company");
        if (user is null) return Results.NotFound(new { message = "Профилът не е намерен." });
        var listings = data.Listings.Where(listing => listing.UserId == userId)
            .Select(listing => new { listing.Service, listing.Title, listing.City, listing.Description, listing.CreatedAt })
            .ToList();
        var portfolio = data.PortfolioProjects.Where(project => project.UserId == userId)
            .OrderByDescending(project => project.CreatedAt)
            .Select(project => new { project.Title, project.Category, project.Description, project.CreatedAt })
            .ToList();
        return Results.Ok(new { id = user.Id, name = user.Name, role = user.Role, city = user.City, region = user.Region, additionalCities = user.AdditionalCities, description = user.ProfileDescription, experience = user.Experience, primaryCategory = user.PrimaryCategory, categories = user.Categories, services = user.Services, workPreference = user.WorkPreference, professionalLink = user.ProfessionalLink, profilePhoto = user.ProfilePhoto, portfolioPhotos = user.PortfolioPhotos, listings, portfolio });
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
        data.Projects.RemoveAll(project => project.ProfessionalId == userId);
        data.Listings.RemoveAll(listing => listing.UserId == userId);
        data.PortfolioProjects.RemoveAll(project => project.UserId == userId);
        data.Favorites.RemoveAll(favorite => favorite.UserId == userId || favorite.ProfessionalId == userId);
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
            .Select(project => new
            {
                project.Id,
                project.Name,
                project.Phone,
                project.Description,
                project.Service,
                project.City,
                project.PreferredPeriod,
                project.ProfessionalId,
                project.Status,
                project.CreatedAt
            })
            .ToList();
        return Results.Ok(projects);
    }
});

app.MapGet("/api/account/favorites", (HttpRequest httpRequest) =>
{
    var userId = GetAuthorizedUserId(httpRequest, activeTokens, dataLock);
    if (userId is null) return Results.Unauthorized();
    lock (dataLock)
        return Results.Ok(data.Favorites.Where(favorite => favorite.UserId == userId)
            .Select(favorite => favorite.ProfessionalId).ToList());
});

app.MapPut("/api/account/favorites", (HttpRequest httpRequest, FavoritesRequest request) =>
{
    var userId = GetAuthorizedUserId(httpRequest, activeTokens, dataLock);
    if (userId is null) return Results.Unauthorized();
    if (request.ProfessionalIds is null || request.ProfessionalIds.Count > 500 ||
        request.ProfessionalIds.Any(id => string.IsNullOrWhiteSpace(id) || id.Length > 64))
        return Results.BadRequest(new { message = "Списъкът с любими профили е невалиден." });

    lock (dataLock)
    {
        var validIds = request.ProfessionalIds.Distinct(StringComparer.Ordinal)
            .Where(id => data.Users.Any(user => user.Id == id && user.Role is "professional" or "company"))
            .ToList();
        data.Favorites.RemoveAll(favorite => favorite.UserId == userId);
        data.Favorites.AddRange(validIds.Select(id => new Favorite { UserId = userId, ProfessionalId = id }));
        SaveData(dataPath, data);
        return Results.Ok(validIds);
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
            .Select(listing => new { listing.Id, listing.Service, listing.Title, listing.City, listing.Description, listing.CreatedAt })
            .ToList();
        return Results.Ok(listings);
    }
});

app.MapPost("/api/account/listings", (HttpRequest httpRequest, ListingRequest request) =>
{
    var userId = GetAuthorizedUserId(httpRequest, activeTokens, dataLock);
    if (userId is null) return Results.Unauthorized();
    if (string.IsNullOrWhiteSpace(request.Service) || request.Service.Trim().Length > 100 ||
        string.IsNullOrWhiteSpace(request.City) ||
        request.City.Trim().Length > 100 ||
        string.IsNullOrWhiteSpace(request.Description) || request.Description.Trim().Length > 2000 ||
        (request.Title?.Trim().Length ?? 0) > 100)
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
            Title = string.IsNullOrWhiteSpace(request.Title) ? request.Service.Trim() : request.Title.Trim(),
            City = request.City.Trim(),
            Description = request.Description.Trim(),
            CreatedAt = DateTimeOffset.UtcNow
        };
        data.Listings.Add(listing);
        SaveData(dataPath, data);
        return Results.Ok(new { listing.Id, listing.Service, listing.Title, listing.City, listing.Description, listing.CreatedAt });
    }
});

app.MapDelete("/api/account/listings/{listingId}", (HttpRequest httpRequest, string listingId) =>
{
    var userId = GetAuthorizedUserId(httpRequest, activeTokens, dataLock);
    if (userId is null) return Results.Unauthorized();
    lock (dataLock)
    {
        var listing = data.Listings.FirstOrDefault(candidate => candidate.Id == listingId && candidate.UserId == userId);
        if (listing is null) return Results.NotFound(new { message = "Обявата не е намерена." });
        data.Listings.Remove(listing);
        SaveData(dataPath, data);
        return Results.Ok(new { message = "Обявата е премахната." });
    }
});

app.MapPost("/api/projects", (HttpRequest httpRequest, ProjectRequest request) =>
{
    var userId = GetAuthorizedUserId(httpRequest, activeTokens, dataLock);
    if (userId is null) return Results.Unauthorized();

    if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Trim().Length > 100 ||
        string.IsNullOrWhiteSpace(request.Phone) || request.Phone.Trim().Length > 40 ||
        string.IsNullOrWhiteSpace(request.Description) || request.Description.Trim().Length > 2000 ||
        (request.Service?.Trim().Length ?? 0) > 100 ||
        (request.City?.Trim().Length ?? 0) > 80 ||
        (request.PreferredPeriod?.Trim().Length ?? 0) > 100)
        return Results.BadRequest(new { message = "Попълнете валидни име, телефон и описание на проекта." });

    lock (dataLock)
    {
        var user = data.Users.FirstOrDefault(candidate => candidate.Id == userId);
        if (user is null) return Results.NotFound(new { message = "Профилът не е намерен." });
        if (user.Role != "client") return Results.Forbid();
        if (!string.IsNullOrWhiteSpace(request.ProfessionalId))
        {
            var listing = data.Listings.FirstOrDefault(candidate =>
                candidate.UserId == request.ProfessionalId &&
                (string.IsNullOrWhiteSpace(request.Service) || candidate.Service == request.Service.Trim()));
            if (listing is null)
                return Results.NotFound(new { message = "Избраният специалист няма активна обява за тази услуга." });
        }

        var project = new Project
        {
            Id = Guid.NewGuid().ToString("N"),
            UserId = userId,
            Name = request.Name.Trim(),
            Phone = request.Phone.Trim(),
            Description = request.Description.Trim(),
            Service = request.Service?.Trim() ?? "",
            City = request.City?.Trim() ?? "",
            PreferredPeriod = request.PreferredPeriod?.Trim() ?? "",
            ProfessionalId = request.ProfessionalId?.Trim() ?? "",
            Status = "Изпратено",
            CreatedAt = DateTimeOffset.UtcNow
        };
        data.Projects.Add(project);
        SaveData(dataPath, data);
        return Results.Ok(new
        {
            project.Id,
            project.Name,
            project.Phone,
            project.Description,
            project.Service,
            project.City,
            project.PreferredPeriod,
            project.ProfessionalId,
            project.Status,
            project.CreatedAt
        });
    }
});

app.MapPost("/api/contact", (ContactRequest request) =>
{
    if (string.IsNullOrWhiteSpace(request.Name) ||
        string.IsNullOrWhiteSpace(request.Email) ||
        !System.Net.Mail.MailAddress.TryCreate(request.Email.Trim(), out _) ||
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

app.MapFallback(async (HttpContext context) =>
{
    context.Response.StatusCode = StatusCodes.Status404NotFound;
    await context.Response.WriteAsync("Not Found");
});
app.Run();

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
    try
    {
        return JsonSerializer.Deserialize<AppData>(File.ReadAllText(path))
            ?? throw new InvalidDataException($"Application data at '{path}' is empty.");
    }
    catch (JsonException exception)
    {
        throw new InvalidDataException($"Application data at '{path}' is not valid JSON.", exception);
    }
}

static bool IsProfessionalCategory(string category) =>
    category is "Боядисване" or "Електро услуги" or "ВиК услуги" or "Монтажи" or
        "Строителство" or "Ремонти" or "Дограма и остъкляване" or "Почистване";

static bool IsServiceInCategory(string category, string service) => category switch
{
    "Боядисване" => service is "Боядисване на стени" or "Шпакловка" or "Декоративни мазилки",
    "Електро услуги" => service is "Ремонт на електроинсталации" or "Монтаж на осветление" or "Смяна на контакти",
    "ВиК услуги" => service is "Смяна на тръби" or "Монтаж на санитария" or "Отпушване на канали",
    "Монтажи" => service is "Сглобяване на мебели" or "Монтаж на врати" or "Монтаж на кухни",
    "Строителство" => service is "Зидария" or "Изливане на бетон" or "Изграждане на основи",
    "Ремонти" => service is "Лепене на плочки" or "Поставяне на ламинат" or "Монтаж на гипсокартон",
    "Дограма и остъкляване" => service is "Монтаж на PVC дограма" or "Остъкляване на тераси" or "Монтаж на комарници",
    "Почистване" => service is "Почистване след ремонт" or "Основно почистване" or "Почистване на прозорци",
    _ => false
};

static bool IsValidImageDataUrl(string? value, int maxLength)
{
    if (string.IsNullOrEmpty(value)) return true;
    if (value.Length > maxLength) return false;
    var separator = value.IndexOf(',');
    if (separator < 0 ||
        value[..separator] is not ("data:image/jpeg;base64" or "data:image/png;base64" or "data:image/webp;base64"))
        return false;
    try
    {
        return Convert.FromBase64String(value[(separator + 1)..]).Length <= 2 * 1024 * 1024;
    }
    catch (FormatException)
    {
        return false;
    }
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
static string HashResetToken(string token) =>
    Convert.ToHexString(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(token)));

record RegisterRequest(
    string Name,
    string Email,
    string Password,
    string? Role,
    string? Phone,
    string? City,
    string? Region = null,
    string? AdditionalCities = null,
    string? PrimaryCategory = null,
    List<string>? Categories = null,
    List<string>? Services = null,
    int? Experience = null,
    string? ProfileDescription = null,
    string? WorkPreference = null,
    string? ProfessionalLink = null,
    string? ProfilePhoto = null,
    List<string>? PortfolioPhotos = null,
    bool TermsAccepted = false,
    bool PrivacyAccepted = false);
record LoginRequest(string Email, string Password);
record PasswordResetRequest(string Email);
record PasswordResetCompletionRequest(string Token, string Password);
record AccountUpdateRequest(string Name, string Email, string? Phone, string? City, string? ProfileDescription, int? Experience);
record ProjectRequest(string Name, string Phone, string Description, string? Service, string? City, string? PreferredPeriod, string? ProfessionalId);
record FavoritesRequest(List<string> ProfessionalIds);
record RequestStatusUpdate(string Status);
record PortfolioRequest(string Title, string Category, string Description);
record ListingRequest(string Service, string City, string Description, string? Title);
record ContactRequest(string Name, string Email, string Topic, string Message);
class AppData { public List<User> Users { get; set; } = []; public List<Project> Projects { get; set; } = []; public List<Listing> Listings { get; set; } = []; public List<PortfolioProject> PortfolioProjects { get; set; } = []; public List<ContactMessage> Messages { get; set; } = []; public List<Favorite> Favorites { get; set; } = []; }
class User { public string Id { get; set; } = ""; public string Name { get; set; } = ""; public string Email { get; set; } = ""; public string Password { get; set; } = ""; public string Role { get; set; } = "client"; public string Phone { get; set; } = ""; public string City { get; set; } = ""; public string Region { get; set; } = ""; public string AdditionalCities { get; set; } = ""; public string PrimaryCategory { get; set; } = ""; public List<string> Categories { get; set; } = []; public List<string> Services { get; set; } = []; public string WorkPreference { get; set; } = ""; public string ProfessionalLink { get; set; } = ""; public string ProfilePhoto { get; set; } = ""; public List<string> PortfolioPhotos { get; set; } = []; public DateTimeOffset? TermsAcceptedAt { get; set; } public DateTimeOffset? PrivacyAcceptedAt { get; set; } public string ProfileDescription { get; set; } = ""; public int? Experience { get; set; } public string PasswordResetTokenHash { get; set; } = ""; public DateTimeOffset? PasswordResetExpiresAt { get; set; } public DateTimeOffset CreatedAt { get; set; } }
class Project { public string Id { get; set; } = ""; public string UserId { get; set; } = ""; public string Name { get; set; } = ""; public string Phone { get; set; } = ""; public string Description { get; set; } = ""; public string Service { get; set; } = ""; public string City { get; set; } = ""; public string PreferredPeriod { get; set; } = ""; public string ProfessionalId { get; set; } = ""; public string Status { get; set; } = "Изпратено"; public DateTimeOffset CreatedAt { get; set; } }
class Listing { public string Id { get; set; } = ""; public string UserId { get; set; } = ""; public string Service { get; set; } = ""; public string Title { get; set; } = ""; public string City { get; set; } = ""; public string Description { get; set; } = ""; public DateTimeOffset CreatedAt { get; set; } }
class PortfolioProject { public string Id { get; set; } = ""; public string UserId { get; set; } = ""; public string Title { get; set; } = ""; public string Category { get; set; } = ""; public string Description { get; set; } = ""; public DateTimeOffset CreatedAt { get; set; } }
class Favorite { public string UserId { get; set; } = ""; public string ProfessionalId { get; set; } = ""; }
class ContactMessage { public string Id { get; set; } = ""; public string Name { get; set; } = ""; public string Email { get; set; } = ""; public string Topic { get; set; } = ""; public string Message { get; set; } = ""; public DateTimeOffset CreatedAt { get; set; } }
