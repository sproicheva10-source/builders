using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.AspNetCore.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

var contentRoot = ResolveContentRoot();
var locationsPath = Path.Combine(contentRoot, "locations.json");
var citiesByRegion = JsonSerializer.Deserialize<Dictionary<string, List<string>>>(File.ReadAllText(locationsPath))
    ?? throw new InvalidDataException($"Location data at '{locationsPath}' is empty.");
var builder = WebApplication.CreateBuilder(new WebApplicationOptions
{
    Args = args,
    ContentRootPath = contentRoot,
    WebRootPath = contentRoot
});
builder.Services.Configure<JsonOptions>(options => options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase);
var connectionString = builder.Configuration.GetConnectionString("StroiHub")
    ?? throw new InvalidOperationException("Connection string 'StroiHub' is not configured.");
var databaseProvider = builder.Configuration["DatabaseProvider"] ?? "SqlServer";
builder.Services.AddDbContextFactory<StroiHubDbContext>(options =>
{
    if (string.Equals(databaseProvider, "Sqlite", StringComparison.OrdinalIgnoreCase))
        options.UseSqlite(connectionString);
    else
        options.UseSqlServer(connectionString);
});
var app = builder.Build();
var legacyDataPath = Path.Combine(app.Environment.ContentRootPath, "data.json");
var dataLock = new object();
var dbFactory = app.Services.GetRequiredService<IDbContextFactory<StroiHubDbContext>>();
var data = LoadData(dbFactory, legacyDataPath);
var dataChanged = app.Environment.IsDevelopment() &&
    EnsureDemoProfessionals(data, app.Environment.ContentRootPath);
if (EnsureProfessionalListings(data))
    dataChanged = true;
if (dataChanged)
    SaveData(dbFactory, data);
var activeTokens = new Dictionary<string, string>();

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
app.MapGet("/", () => Results.Redirect("/index.html"));
app.UseDefaultFiles();
app.UseStaticFiles();

app.MapPost("/api/auth/register", (RegisterRequest request) =>
{
    var isProfessional = request.Role == "professional";
    if (!IsValidEmail(request.Email))
        return Results.BadRequest(new { message = "Въведи валиден имейл адрес с домейн, например name@example.com." });
    if (request.Password is null || !IsValidPassword(request.Password))
        return Results.BadRequest(new { message = "Паролата трябва да е 8–128 символа и да съдържа главна и малка буква и поне една цифра." });

    if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Trim().Length > 100 ||
        string.IsNullOrWhiteSpace(request.Phone) || request.Phone.Trim().Length > 40 ||
        !IsValidPhone(request.Phone) ||
        string.IsNullOrWhiteSpace(request.City) || request.City.Trim().Length > 80 ||
        !IsValidRegion(request.Region) ||
        (isProfessional && !IsCityInRegion(citiesByRegion, request.Region, request.City)) ||
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
        return Results.BadRequest(new { message = "Попълнете всички задължителни полета с валидни данни." });

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
            Phone = NormalizePhone(request.Phone),
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
        if (isProfessional)
        {
            data.Listings.AddRange(user.Services.Select(service => new Listing
            {
                Id = Guid.NewGuid().ToString("N"),
                UserId = user.Id,
                Service = service,
                Title = service,
                City = user.City,
                Description = user.ProfileDescription,
                CreatedAt = user.CreatedAt
            }));
        }
        SaveData(dbFactory, data);
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
        SaveData(dbFactory, data);
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
        SaveData(dbFactory, data);
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
        SaveData(dbFactory, data);
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
    if (!IsValidEmail(request.Email))
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
        SaveData(dbFactory, data);
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
                SaveData(dbFactory, data);
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
    if (string.IsNullOrWhiteSpace(request.Token))
        return Results.BadRequest(new { message = "Линкът е невалиден или е изтекъл. Поискай нов." });
    if (request.Password is null || !IsValidPassword(request.Password))
        return Results.BadRequest(new { message = "Паролата трябва да е 8–128 символа и да съдържа главна и малка буква и поне една цифра." });

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
        SaveData(dbFactory, data);
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
        !IsValidEmail(request.Email) ||
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
        SaveData(dbFactory, data);
        return Results.Ok(new { user = new { user.Name, user.Email, user.Role, user.Phone, user.City, user.ProfileDescription, user.Experience } });
    }
});

app.MapGet("/api/professionals", (string? service, string? city) =>
{
    lock (dataLock)
    {
        var profiles = data.Listings
            .Where(listing =>
                (string.IsNullOrWhiteSpace(service) ||
                 listing.Service.Equals(service.Trim(), StringComparison.OrdinalIgnoreCase) ||
                 IsServiceInCategory(service.Trim(), listing.Service)) &&
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
                profilePhoto = entry.User.ProfilePhoto,
                isDemo = IsDemoProfessional(entry.User),
                service = entry.Service,
                serviceCategories = GetServiceCategories(entry.Service),
                title = entry.Title,
                city = entry.City,
                description = entry.Description,
                reviews = GetPublishedReviews(data, entry.UserId),
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
        return Results.Ok(new { id = user.Id, name = user.Name, role = user.Role, isDemo = IsDemoProfessional(user), city = user.City, region = user.Region, additionalCities = user.AdditionalCities, description = user.ProfileDescription, experience = user.Experience, primaryCategory = user.PrimaryCategory, categories = user.Categories, services = user.Services, workPreference = user.WorkPreference, professionalLink = user.ProfessionalLink, profilePhoto = user.ProfilePhoto, portfolioPhotos = user.PortfolioPhotos, reviews = GetProfileReviews(data, user), listings, portfolio });
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
        SaveData(dbFactory, data);
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

app.MapGet("/api/account/reviews/eligible/{professionalId}", (HttpRequest httpRequest, string professionalId) =>
{
    var userId = GetAuthorizedUserId(httpRequest, activeTokens, dataLock);
    if (userId is null) return Results.Unauthorized();
    lock (dataLock)
    {
        var user = data.Users.FirstOrDefault(candidate => candidate.Id == userId);
        if (user is null) return Results.NotFound(new { message = "Профилът не е намерен." });
        if (user.Role != "client") return Results.Forbid();
        return Results.Ok(data.Projects
            .Where(project => project.UserId == userId &&
                project.ProfessionalId == professionalId &&
                project.Status == "Приключено" &&
                !data.Reviews.Any(review => review.ProjectId == project.Id))
            .OrderByDescending(project => project.CreatedAt)
            .Select(project => new { project.Id, project.Service, project.City, project.CreatedAt })
            .ToList());
    }
});

app.MapGet("/api/account/reviews", (HttpRequest httpRequest) =>
{
    var userId = GetAuthorizedUserId(httpRequest, activeTokens, dataLock);
    if (userId is null) return Results.Unauthorized();
    lock (dataLock)
    {
        var user = data.Users.FirstOrDefault(candidate => candidate.Id == userId);
        if (user is null) return Results.NotFound(new { message = "Профилът не е намерен." });
        if (user.Role is not ("professional" or "company")) return Results.Forbid();
        var reviews = GetPublishedReviews(data, userId);
        var average = reviews.Length == 0 ? (double?)null : reviews.Average(review => review.Rating);
        return Results.Ok(new { reviews, average });
    }
});

app.MapPost("/api/account/reviews", (HttpRequest httpRequest, ReviewRequest request) =>
{
    var userId = GetAuthorizedUserId(httpRequest, activeTokens, dataLock);
    if (userId is null) return Results.Unauthorized();
    if (string.IsNullOrWhiteSpace(request.ProjectId) || request.ProjectId.Length > 64 ||
        request.Rating is < 1 or > 5 ||
        string.IsNullOrWhiteSpace(request.Comment) ||
        request.Comment.Trim().Length is < 10 or > 1000)
        return Results.BadRequest(new { message = "Избери оценка от 1 до 5 и напиши мнение от 10 до 1000 символа." });

    lock (dataLock)
    {
        var user = data.Users.FirstOrDefault(candidate => candidate.Id == userId);
        if (user is null) return Results.NotFound(new { message = "Профилът не е намерен." });
        if (user.Role != "client") return Results.Forbid();
        var project = data.Projects.FirstOrDefault(candidate =>
            candidate.Id == request.ProjectId &&
            candidate.UserId == userId &&
            candidate.Status == "Приключено" &&
            !string.IsNullOrWhiteSpace(candidate.ProfessionalId));
        if (project is null)
            return Results.Conflict(new { message = "Мнение може да се остави само за приключена услуга от твоя профил." });
        if (data.Reviews.Any(review => review.ProjectId == project.Id))
            return Results.Conflict(new { message = "Вече има публикувано мнение за тази услуга." });
        if (!data.Users.Any(candidate =>
                candidate.Id == project.ProfessionalId &&
                candidate.Role is "professional" or "company"))
            return Results.Conflict(new { message = "Профилът на специалиста вече не е наличен." });

        var review = new Review
        {
            Id = Guid.NewGuid().ToString("N"),
            ProjectId = project.Id,
            ProfessionalId = project.ProfessionalId,
            ReviewerId = userId,
            Rating = request.Rating,
            Comment = request.Comment.Trim(),
            CreatedAt = DateTimeOffset.UtcNow
        };
        data.Reviews.Add(review);
        SaveData(dbFactory, data);
        return Results.Created($"/api/professionals/{project.ProfessionalId}", new { review.Id });
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
        SaveData(dbFactory, data);
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
        SaveData(dbFactory, data);
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
        SaveData(dbFactory, data);
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
        SaveData(dbFactory, data);
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

app.MapPost("/api/contact", async (ContactRequest request, IConfiguration configuration) =>
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
        SaveData(dbFactory, data);
    }

    var smtpHost = configuration["STROIHUB_SMTP_HOST"];
    var smtpFrom = configuration["STROIHUB_SMTP_FROM"];
    var smtpUser = configuration["STROIHUB_SMTP_USER"];
    var smtpPassword = configuration["STROIHUB_SMTP_PASSWORD"];
    var contactTo = configuration["STROIHUB_CONTACT_TO"] ?? "stroihub27@gmail.com";
    var port = int.TryParse(configuration["STROIHUB_SMTP_PORT"], out var configuredPort) ? configuredPort : 587;

    if (string.IsNullOrWhiteSpace(smtpHost) ||
        string.IsNullOrWhiteSpace(smtpFrom) ||
        string.IsNullOrWhiteSpace(smtpUser) ||
        string.IsNullOrWhiteSpace(smtpPassword) ||
        port is < 1 or > 65535 ||
        !System.Net.Mail.MailAddress.TryCreate(smtpFrom, out _) ||
        !System.Net.Mail.MailAddress.TryCreate(contactTo, out _))
        return Results.Problem("Изпращането по имейл не е конфигурирано.", statusCode: StatusCodes.Status503ServiceUnavailable);

    var message = new System.Net.Mail.MailMessage(smtpFrom, contactTo)
    {
        Subject = "Ново съобщение от формата на StroiHub",
        IsBodyHtml = true,
        BodyEncoding = System.Text.Encoding.UTF8,
        SubjectEncoding = System.Text.Encoding.UTF8
    };
    message.ReplyToList.Add(request.Email.Trim());

    var name = System.Net.WebUtility.HtmlEncode(request.Name.Trim());
    var email = System.Net.WebUtility.HtmlEncode(request.Email.Trim());
    var topic = System.Net.WebUtility.HtmlEncode(string.IsNullOrWhiteSpace(request.Topic) ? "Общ въпрос" : request.Topic.Trim());
    var submittedMessage = System.Net.WebUtility.HtmlEncode(request.Message.Trim()).Replace("\r\n", "<br>").Replace("\n", "<br>");
    var submittedAt = DateTime.Now.ToString("HH:mm, d MMMM yyyy", new System.Globalization.CultureInfo("bg-BG"));

    message.Body = $$"""
        <div style="background:#f3f5f7;padding:32px 12px;font-family:Arial,sans-serif;color:#294968;">
          <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:8px;padding:30px;">
            <h1 style="margin:0 0 8px;color:#294968;font-size:28px;">Ново съобщение от формата на StroiHub</h1>
            <p style="margin:0 0 24px;color:#526b84;font-size:16px;">Посетител изпрати съобщение чрез сайта:</p>
            <div style="margin-bottom:22px;">
              <div style="color:#526b84;font-size:14px;margin-bottom:4px;">Име</div>
              <div style="color:#294968;font-size:18px;">{{name}}</div>
            </div>
            <div style="margin-bottom:22px;">
              <div style="color:#526b84;font-size:14px;margin-bottom:4px;">Имейл</div>
              <div style="font-size:18px;"><a href="mailto:{{email}}" style="color:#0786c7;">{{email}}</a></div>
            </div>
            <div style="margin-bottom:22px;">
              <div style="color:#526b84;font-size:14px;margin-bottom:4px;">Тема</div>
              <div style="color:#294968;font-size:18px;">{{topic}}</div>
            </div>
            <div style="margin-bottom:28px;">
              <div style="color:#526b84;font-size:14px;margin-bottom:4px;">Съобщение</div>
              <div style="color:#294968;font-size:18px;line-height:1.5;">{{submittedMessage}}</div>
            </div>
            <hr style="border:0;border-top:1px solid #e1edf5;margin:26px 0 18px;">
            <div style="color:#526b84;font-size:14px;">Изпратено на {{submittedAt}}</div>
          </div>
        </div>
        """;

    try
    {
        using var smtp = new System.Net.Mail.SmtpClient(smtpHost, port)
        {
            EnableSsl = true,
            Credentials = new System.Net.NetworkCredential(smtpUser, smtpPassword)
        };
        await smtp.SendMailAsync(message);
    }
    catch (System.Net.Mail.SmtpException exception)
    {
        return Results.Problem($"Съобщението не беше изпратено: {exception.StatusCode}", statusCode: StatusCodes.Status502BadGateway);
    }

    return Results.Ok(new { message = "Съобщението е изпратено успешно." });
});

app.MapFallback(async (HttpContext context) =>
{
    context.Response.StatusCode = StatusCodes.Status404NotFound;
    await context.Response.WriteAsync("Not Found");
});
app.Run();

static string ResolveContentRoot()
{
    DirectoryInfo? directory = new(AppContext.BaseDirectory);
    while (directory is not null)
    {
        if (File.Exists(Path.Combine(directory.FullName, "StroiHub.csproj")))
            return directory.FullName;
        directory = directory.Parent;
    }
    return Directory.GetCurrentDirectory();
}

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

static PublishedReview[] GetPublishedReviews(AppData data, string professionalId) =>
    data.Reviews
        .Where(review => review.ProfessionalId == professionalId)
        .OrderByDescending(review => review.CreatedAt)
        .Select(review =>
        {
            var reviewer = data.Users.FirstOrDefault(user => user.Id == review.ReviewerId);
            return reviewer is null
                ? null
                : new PublishedReview(reviewer.Name, reviewer.ProfilePhoto, review.Rating, review.Comment, review.CreatedAt, false);
        })
        .Where(review => review is not null)
        .Select(review => review!)
        .ToArray();

static PublishedReview[] GetProfileReviews(AppData data, User professional) =>
    GetPublishedReviews(data, professional.Id)
        .Concat(GetDemoReviews(professional))
        .OrderByDescending(review => review.CreatedAt)
        .ToArray();

static PublishedReview[] GetDemoReviews(User professional)
{
    if (!IsDemoProfessional(professional) ||
        !int.TryParse(professional.Email.AsSpan("demo-pro-".Length, 2), out var number))
        return [];

    var review = number switch
    {
        1 => new DemoReviewSeed("Ралица Тодорова", "image_b2f9b43f.jpg", 5, "Подготовката на стените беше много старателна, а боята легна равномерно. Работното място остана чисто.", 8),
        2 => new DemoReviewSeed("Никола Маринов", "image_b57e7376.jpg", 5, "Смяната на смесителя и сифона мина бързо. Получих ясна информация какви части са нужни.", 9),
        3 => new DemoReviewSeed("Елена Петрова", "image_c352862.jpg", 5, "Монтира осветителните тела внимателно и провери работата им преди да приключи.", 10),
        4 => new DemoReviewSeed("Мартин Георгиев", "image_cf9fb080.jpg", 4, "Няколко домашни поправки бяха изпълнени в уговорения ден и с добра комуникация.", 11),
        5 => new DemoReviewSeed("Десислава Николова", "image_dfa67aaf.jpg", 5, "Сглоби мебелите стабилно и нивелира шкафовете. Много внимателна работа.", 12),
        6 => new DemoReviewSeed("Пламен Стоянов", "image_e15ec964.jpg", 5, "Регулирането на дограмата помогна прозорците да се затварят добре. Обясни и какво е направено.", 13),
        7 => new DemoReviewSeed("Силвия Димова", "image_f0fd81f2.jpg", 5, "Почистването след ремонта беше подробно, включително по первазите и труднодостъпните места.", 14),
        8 => new DemoReviewSeed("Виктор Илиев", "image_2e98e854.jpg", 4, "Зидарската работа беше добре планирана и изпълнена според уговорения обхват.", 15),
        9 => new DemoReviewSeed("Анна Христова", "image_5aecc4ec.jpg", 5, "Стените бяха подготвени добре и цветът стана точно както го бяхме уточнили.", 16),
        10 => new DemoReviewSeed("Борис Колев", "image_9bdeee59.jpg", 5, "Монтажът на санитарните аксесоари беше чист и прецизен. Всичко беше проверено накрая.", 17),
        _ => default
    };

    if (review is null)
        return [];

    var photoPath = Path.Combine("images", "New folder", review.Photo);
    if (!File.Exists(Path.Combine(ResolveContentRoot(), photoPath)))
        return [];

    return
    [
        new PublishedReview(
            review.Author,
            "/images/New%20folder/" + review.Photo,
            review.Rating,
            review.Comment,
            new DateTimeOffset(2026, 11, review.Day, 12, 0, 0, TimeSpan.FromHours(2)),
            true)
    ];
}

static AppData LoadData(
    IDbContextFactory<StroiHubDbContext> dbFactory,
    string legacyDataPath)
{
    using var db = dbFactory.CreateDbContext();
    db.Database.EnsureCreated();
    EnsureReviewsTable(db);
    var data = new AppData
    {
        Users = db.Users.AsNoTracking().ToList(),
        Projects = db.Projects.AsNoTracking().ToList(),
        Listings = db.Listings.AsNoTracking().ToList(),
        PortfolioProjects = db.PortfolioProjects.AsNoTracking().ToList(),
        Messages = db.Messages.AsNoTracking().ToList(),
        Favorites = db.Favorites.AsNoTracking().ToList(),
        Reviews = db.Reviews.AsNoTracking().ToList()
    };
    if (HasData(data) || !File.Exists(legacyDataPath))
        return data;

    AppData legacyData;
    try
    {
        legacyData = JsonSerializer.Deserialize<AppData>(File.ReadAllText(legacyDataPath))
            ?? throw new InvalidDataException($"Application data at '{legacyDataPath}' is empty.");
    }
    catch (JsonException exception)
    {
        throw new InvalidDataException($"Application data at '{legacyDataPath}' is not valid JSON.", exception);
    }
    if (HasData(legacyData))
        SaveData(dbFactory, legacyData);
    return legacyData;
}

static void EnsureReviewsTable(StroiHubDbContext db)
{
    if (db.Database.IsSqlite())
    {
        db.Database.ExecuteSqlRaw(
            "CREATE TABLE IF NOT EXISTS \"Reviews\" (\"Id\" TEXT NOT NULL CONSTRAINT \"PK_Reviews\" PRIMARY KEY, \"ProjectId\" TEXT NOT NULL, \"ProfessionalId\" TEXT NOT NULL, \"ReviewerId\" TEXT NOT NULL, \"Rating\" INTEGER NOT NULL, \"Comment\" TEXT NOT NULL, \"CreatedAt\" TEXT NOT NULL)");
        db.Database.ExecuteSqlRaw(
            "CREATE UNIQUE INDEX IF NOT EXISTS \"IX_Reviews_ProjectId\" ON \"Reviews\" (\"ProjectId\")");
        return;
    }

    db.Database.ExecuteSqlRaw(
        "IF OBJECT_ID(N'[Reviews]', N'U') IS NULL CREATE TABLE [Reviews] ([Id] nvarchar(32) NOT NULL CONSTRAINT [PK_Reviews] PRIMARY KEY, [ProjectId] nvarchar(64) NOT NULL, [ProfessionalId] nvarchar(64) NOT NULL, [ReviewerId] nvarchar(64) NOT NULL, [Rating] int NOT NULL, [Comment] nvarchar(1000) NOT NULL, [CreatedAt] datetimeoffset NOT NULL)");
    db.Database.ExecuteSqlRaw(
        "IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Reviews_ProjectId' AND object_id = OBJECT_ID(N'[Reviews]')) CREATE UNIQUE INDEX [IX_Reviews_ProjectId] ON [Reviews] ([ProjectId])");
}

static bool EnsureProfessionalListings(AppData data)
{
    var changed = false;
    foreach (var user in data.Users.Where(user => user.Role is "professional" or "company"))
    {
        foreach (var service in user.Services.Where(service => !string.IsNullOrWhiteSpace(service)))
        {
            var normalizedService = service.Trim();
            if (data.Listings.Any(listing =>
                listing.UserId == user.Id &&
                listing.Service.Equals(normalizedService, StringComparison.OrdinalIgnoreCase) &&
                listing.City.Equals(user.City, StringComparison.OrdinalIgnoreCase)))
                continue;

            data.Listings.Add(new Listing
            {
                Id = Guid.NewGuid().ToString("N"),
                UserId = user.Id,
                Service = normalizedService,
                Title = normalizedService,
                City = user.City,
                Description = user.ProfileDescription,
                CreatedAt = user.CreatedAt
            });
            changed = true;
        }
    }

    return changed;
}

static bool EnsureDemoProfessionals(AppData data, string contentRoot)
{
    var demoProfiles = new[]
    {
        (Name: "Иван Петров", City: "София", Region: "София-град", Service: "Боядисване", Experience: 8, Photo: "profile-12.png", Description: "Занимавам се с интериорно боядисване, подготовка на стени и фино шпакловане в София. Преди работа уточнявам обхвата, цветовете и защитата на помещенията, а накрая оставям работното място подредено."),
        (Name: "Георги Димитров", City: "Пловдив", Region: "Пловдив", Service: "ВиК услуги", Experience: 11, Photo: "profile-13.png", Description: "Извършвам ВиК ремонти в Пловдив — смяна на смесители и сифони, монтаж на санитария и отстраняване на течове. След оглед обсъждам необходимите материали и обема на работата."),
        (Name: "Николай Иванов", City: "Варна", Region: "Варна", Service: "Електро услуги", Experience: 7, Photo: "profile-11.png", Description: "Предлагам електро услуги във Варна, включително монтаж на осветителни тела, подмяна на контакти и диагностика на дребни неизправности. Уточнявам задачата предварително и проверявам изпълнението след монтажа."),
        (Name: "Даниел Петров", City: "Бургас", Region: "Бургас", Service: "Ремонти", Experience: 9, Photo: "profile-05.png", Description: "Поемам малки домашни ремонти в Бургас — довършителни работи, поправки и монтажи. Уточнявам нужните материали и срок преди започване и поддържам работната зона чиста."),
        (Name: "Александър Николов", City: "Русе", Region: "Русе", Service: "Монтажи", Experience: 6, Photo: "profile-08.png", Description: "Сглобявам мебели и монтирам шкафове, врати и кухненски модули в Русе. Работя по размерите на помещението и проверявам нивелацията, крепежите и плавното отваряне."),
        (Name: "Мартин Георгиев", City: "Стара Загора", Region: "Стара Загора", Service: "Дограма и остъкляване", Experience: 12, Photo: "profile-03.png", Description: "Занимавам се с монтаж и обслужване на дограма в Стара Загора — регулиране на прозорци, смяна на уплътнения и дребни монтажни дейности. След оглед предлагам подходящ вариант според състоянието."),
        (Name: "Христо Михайлов", City: "Плевен", Region: "Плевен", Service: "Почистване", Experience: 5, Photo: "profile-02.png", Description: "Предлагам почистване на жилища и помещения след ремонт в Плевен. Работя по предварително уточнен списък и обръщам внимание на праха по повърхностите и финалното почистване."),
        (Name: "Петър Стоянов", City: "Велико Търново", Region: "Велико Търново", Service: "Строителство", Experience: 10, Photo: "profile-10.png", Description: "Изпълнявам строителни и зидарски дейности във Велико Търново за малки ремонтни проекти. Планирам работата по етапи и предварително уточнявам материалите и срока."),
        (Name: "Димитър Колев", City: "Благоевград", Region: "Благоевград", Service: "Боядисване", Experience: 4, Photo: "profile-06.png", Description: "Извършвам боядисване и подготовка на стени в Благоевград, включително шпакловане и освежаване на интериори. Предварително обсъждам цветовете, подготовката и защитата на помещенията."),
        (Name: "Стефан Василев", City: "Добрич", Region: "Добрич", Service: "ВиК услуги", Experience: 8, Photo: "profile-04.png", Description: "Предлагам ВиК услуги в Добрич — монтаж на санитарни аксесоари, подмяна на смесители и локални ремонти. След оглед описвам необходимите материали и съгласувам обхвата.")
    };
    var changed = false;
    for (var index = 0; index < demoProfiles.Length; index++)
    {
        var profile = demoProfiles[index];
        var email = $"demo-pro-{index + 1:D2}@example.invalid";
        var user = data.Users.FirstOrDefault(candidate =>
            candidate.Email.Equals(email, StringComparison.OrdinalIgnoreCase));
        if (user is null)
        {
            user = new User
            {
                Id = Guid.NewGuid().ToString("N"),
                Email = email,
                Password = HashPassword(Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))),
                Role = "professional",
                CreatedAt = DateTimeOffset.UtcNow
            };
            data.Users.Add(user);
            changed = true;
        }

        var photoPath = Path.Combine(contentRoot, "images", "professionals", profile.Photo);
        var profilePhoto = File.Exists(photoPath) ? "/images/professionals/" + profile.Photo : "";
        var description = profile.Description;
        if (user.Name != profile.Name || user.City != profile.City || user.Region != profile.Region ||
            user.PrimaryCategory != profile.Service || user.Experience != profile.Experience ||
            user.ProfileDescription != description || user.ProfilePhoto != profilePhoto ||
            !user.Categories.SequenceEqual([profile.Service]) ||
            !user.Services.SequenceEqual([profile.Service]))
        {
            user.Name = profile.Name;
            user.City = profile.City;
            user.Region = profile.Region;
            user.PrimaryCategory = profile.Service;
            user.Categories = [profile.Service];
            user.Services = [profile.Service];
            user.Experience = profile.Experience;
            user.ProfileDescription = description;
            user.ProfilePhoto = profilePhoto;
            changed = true;
        }

        foreach (var listing in data.Listings.Where(listing => listing.UserId == user.Id))
        {
            if (listing.Service == profile.Service && listing.Title == profile.Service &&
                listing.City == profile.City && listing.Description == description)
                continue;
            listing.Service = profile.Service;
            listing.Title = profile.Service;
            listing.City = profile.City;
            listing.Description = description;
            changed = true;
        }
    }

    return changed;
}

static bool IsDemoProfessional(User user) =>
    user.Email.StartsWith("demo-pro-", StringComparison.OrdinalIgnoreCase) &&
    user.Email.EndsWith("@example.invalid", StringComparison.OrdinalIgnoreCase);

static bool HasData(AppData data) =>
    data.Users.Count > 0 ||
    data.Projects.Count > 0 ||
    data.Listings.Count > 0 ||
    data.PortfolioProjects.Count > 0 ||
    data.Messages.Count > 0 ||
    data.Favorites.Count > 0;

static bool IsProfessionalCategory(string category) =>
    category is "Боядисване" or "Електро услуги" or "ВиК услуги" or "Монтажи" or
        "Строителство" or "Ремонти" or "Дограма и остъкляване" or "Почистване";

static bool IsValidPhone(string phone)
{
    var normalized = NormalizePhone(phone);
    if (!System.Text.RegularExpressions.Regex.IsMatch(normalized, @"^\+[1-9]\d{9,11}$"))
        return false;
    var digits = normalized[1..];
    var countryCallingCodes = "1 7 20 27 30 31 32 33 34 36 39 40 41 43 44 45 46 47 48 49 " +
        "51 52 53 54 55 56 57 58 60 61 62 63 64 65 66 81 82 84 86 " +
        "90 91 92 93 94 95 98 211 212 213 216 218 " +
        "220 221 222 223 224 225 226 227 228 229 230 231 232 233 234 " +
        "235 236 237 238 239 240 241 242 243 244 245 246 247 248 249 " +
        "250 251 252 253 254 255 256 257 258 260 261 262 263 264 265 266 267 268 269 " +
        "290 291 297 298 299 " +
        "350 351 352 353 354 355 356 357 358 359 370 371 372 373 374 375 376 377 378 380 381 382 383 385 386 387 389 " +
        "420 421 423 " +
        "500 501 502 503 504 505 506 507 508 509 " +
        "590 591 592 593 594 595 596 597 598 599 " +
        "670 672 673 674 675 676 677 678 679 680 681 682 683 685 686 687 688 689 690 691 692 " +
        "850 852 853 855 856 880 886 " +
        "960 961 962 963 964 965 966 967 968 970 971 972 973 974 975 976 977 " +
        "992 993 994 995 996 998";
    return countryCallingCodes.Split(' ').Any(code =>
        digits.StartsWith(code, StringComparison.Ordinal) && digits.Length - code.Length == 9);
}

static bool IsValidEmail(string? email)
{
    if (string.IsNullOrWhiteSpace(email) || email.Trim().Length > 254 ||
        !System.Net.Mail.MailAddress.TryCreate(email.Trim(), out _))
        return false;

    var value = email.Trim();
    var separator = value.IndexOf('@');
    if (separator <= 0 || separator != value.LastIndexOf('@'))
        return false;

    var labels = value[(separator + 1)..].Split('.');
    if (labels.Length < 2 || labels.Any(label =>
            label.Length is < 2 or > 63 ||
            !System.Text.RegularExpressions.Regex.IsMatch(label, @"^[a-z0-9](?:[a-z0-9-]*[a-z0-9])$", System.Text.RegularExpressions.RegexOptions.IgnoreCase)))
        return false;

    var topLevelDomain = labels[^1];
    return System.Text.RegularExpressions.Regex.IsMatch(topLevelDomain, @"^[a-z]{2,}$", System.Text.RegularExpressions.RegexOptions.IgnoreCase) ||
        System.Text.RegularExpressions.Regex.IsMatch(topLevelDomain, @"^xn--[a-z0-9-]{2,}$", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
}

static bool IsValidPassword(string? password) =>
    password is { Length: >= 8 and <= 128 } &&
    password.Any(char.IsUpper) &&
    password.Any(char.IsLower) &&
    password.Any(char.IsDigit);

static string NormalizePhone(string? phone) =>
    System.Text.RegularExpressions.Regex.Replace(phone?.Trim() ?? "", @"[\s().-]", "");

static bool IsValidRegion(string? region) =>
    region is "Благоевград" or "Бургас" or "Варна" or "Велико Търново" or
        "Видин" or "Враца" or "Габрово" or "Добрич" or "Кърджали" or
        "Кюстендил" or "Ловеч" or "Монтана" or "Пазарджик" or "Перник" or
        "Плевен" or "Пловдив" or "Разград" or "Русе" or "Силистра" or
        "Сливен" or "Смолян" or "София-град" or "София-област" or
        "Стара Загора" or "Търговище" or "Хасково" or "Шумен" or "Ямбол";

static bool IsCityInRegion(
    IReadOnlyDictionary<string, List<string>> citiesByRegion,
    string? region,
    string? city) =>
    region is not null &&
    city is not null &&
    citiesByRegion.TryGetValue(region, out var cities) &&
    cities.Contains(city.Trim(), StringComparer.Ordinal);

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

static string[] GetServiceCategories(string service) =>
    new[]
    {
        "Боядисване", "Електро услуги", "ВиК услуги", "Монтажи",
        "Строителство", "Ремонти", "Дограма и остъкляване", "Почистване"
    }
    .Where(category => IsServiceInCategory(category, service))
    .ToArray();

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

static void SaveData(IDbContextFactory<StroiHubDbContext> dbFactory, AppData data)
{
    using var db = dbFactory.CreateDbContext();
    using var transaction = db.Database.BeginTransaction();
    db.Users.RemoveRange(db.Users.ToList());
    db.Projects.RemoveRange(db.Projects.ToList());
    db.Listings.RemoveRange(db.Listings.ToList());
    db.PortfolioProjects.RemoveRange(db.PortfolioProjects.ToList());
    db.Messages.RemoveRange(db.Messages.ToList());
    db.Favorites.RemoveRange(db.Favorites.ToList());
    db.Reviews.RemoveRange(db.Reviews.ToList());
    db.SaveChanges();

    db.Users.AddRange(data.Users);
    db.Projects.AddRange(data.Projects);
    db.Listings.AddRange(data.Listings);
    db.PortfolioProjects.AddRange(data.PortfolioProjects);
    db.Messages.AddRange(data.Messages);
    db.Favorites.AddRange(data.Favorites);
    db.Reviews.AddRange(data.Reviews);
    db.SaveChanges();
    transaction.Commit();
}

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
record ReviewRequest(string ProjectId, int Rating, string Comment);
record PublishedReview(string Author, string AuthorPhoto, int Rating, string Comment, DateTimeOffset CreatedAt, bool IsDemo);
record DemoReviewSeed(string Author, string Photo, int Rating, string Comment, int Day);
record PortfolioRequest(string Title, string Category, string Description);
record ListingRequest(string Service, string City, string Description, string? Title);
record ContactRequest(string Name, string Email, string Topic, string Message);
class AppData { public List<User> Users { get; set; } = []; public List<Project> Projects { get; set; } = []; public List<Listing> Listings { get; set; } = []; public List<PortfolioProject> PortfolioProjects { get; set; } = []; public List<ContactMessage> Messages { get; set; } = []; public List<Favorite> Favorites { get; set; } = []; public List<Review> Reviews { get; set; } = []; }
class User { public string Id { get; set; } = ""; public string Name { get; set; } = ""; public string Email { get; set; } = ""; public string Password { get; set; } = ""; public string Role { get; set; } = "client"; public string Phone { get; set; } = ""; public string City { get; set; } = ""; public string Region { get; set; } = ""; public string AdditionalCities { get; set; } = ""; public string PrimaryCategory { get; set; } = ""; public List<string> Categories { get; set; } = []; public List<string> Services { get; set; } = []; public string WorkPreference { get; set; } = ""; public string ProfessionalLink { get; set; } = ""; public string ProfilePhoto { get; set; } = ""; public List<string> PortfolioPhotos { get; set; } = []; public DateTimeOffset? TermsAcceptedAt { get; set; } public DateTimeOffset? PrivacyAcceptedAt { get; set; } public string ProfileDescription { get; set; } = ""; public int? Experience { get; set; } public string PasswordResetTokenHash { get; set; } = ""; public DateTimeOffset? PasswordResetExpiresAt { get; set; } public DateTimeOffset CreatedAt { get; set; } }
class Project { public string Id { get; set; } = ""; public string UserId { get; set; } = ""; public string Name { get; set; } = ""; public string Phone { get; set; } = ""; public string Description { get; set; } = ""; public string Service { get; set; } = ""; public string City { get; set; } = ""; public string PreferredPeriod { get; set; } = ""; public string ProfessionalId { get; set; } = ""; public string Status { get; set; } = "Изпратено"; public DateTimeOffset CreatedAt { get; set; } }
class Listing { public string Id { get; set; } = ""; public string UserId { get; set; } = ""; public string Service { get; set; } = ""; public string Title { get; set; } = ""; public string City { get; set; } = ""; public string Description { get; set; } = ""; public DateTimeOffset CreatedAt { get; set; } }
class PortfolioProject { public string Id { get; set; } = ""; public string UserId { get; set; } = ""; public string Title { get; set; } = ""; public string Category { get; set; } = ""; public string Description { get; set; } = ""; public DateTimeOffset CreatedAt { get; set; } }
class Favorite { public string UserId { get; set; } = ""; public string ProfessionalId { get; set; } = ""; }
class Review { public string Id { get; set; } = ""; public string ProjectId { get; set; } = ""; public string ProfessionalId { get; set; } = ""; public string ReviewerId { get; set; } = ""; public int Rating { get; set; } public string Comment { get; set; } = ""; public DateTimeOffset CreatedAt { get; set; } }
class ContactMessage { public string Id { get; set; } = ""; public string Name { get; set; } = ""; public string Email { get; set; } = ""; public string Topic { get; set; } = ""; public string Message { get; set; } = ""; public DateTimeOffset CreatedAt { get; set; } }

class StroiHubDbContext(DbContextOptions<StroiHubDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<Listing> Listings => Set<Listing>();
    public DbSet<PortfolioProject> PortfolioProjects => Set<PortfolioProject>();
    public DbSet<Favorite> Favorites => Set<Favorite>();
    public DbSet<ContactMessage> Messages => Set<ContactMessage>();
    public DbSet<Review> Reviews => Set<Review>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var users = modelBuilder.Entity<User>();
        users.HasKey(user => user.Id);
        users.Property(user => user.Id).HasMaxLength(32);
        users.Property(user => user.Email).HasMaxLength(254).IsRequired();
        users.HasIndex(user => user.Email).IsUnique();
        ConfigureStringList(users.Property(user => user.Categories));
        ConfigureStringList(users.Property(user => user.Services));
        ConfigureStringList(users.Property(user => user.PortfolioPhotos));

        modelBuilder.Entity<Project>().HasKey(project => project.Id);
        modelBuilder.Entity<Listing>().HasKey(listing => listing.Id);
        modelBuilder.Entity<PortfolioProject>().HasKey(project => project.Id);
        var favorites = modelBuilder.Entity<Favorite>();
        favorites.HasKey(favorite => new { favorite.UserId, favorite.ProfessionalId });
        favorites.Property(favorite => favorite.UserId).HasMaxLength(64);
        favorites.Property(favorite => favorite.ProfessionalId).HasMaxLength(64);

        var messages = modelBuilder.Entity<ContactMessage>();
        messages.HasKey(message => message.Id);
        messages.Property(message => message.Email).HasMaxLength(254);

        var reviews = modelBuilder.Entity<Review>();
        reviews.HasKey(review => review.Id);
        reviews.Property(review => review.Id).HasMaxLength(32);
        reviews.Property(review => review.ProjectId).HasMaxLength(64);
        reviews.HasIndex(review => review.ProjectId).IsUnique();
        reviews.Property(review => review.ProfessionalId).HasMaxLength(64);
        reviews.Property(review => review.ReviewerId).HasMaxLength(64);
        reviews.Property(review => review.Comment).HasMaxLength(1000);
    }

    private static void ConfigureStringList(PropertyBuilder<List<string>> property)
    {
        var converter = new ValueConverter<List<string>, string>(
            value => JsonSerializer.Serialize(value, (JsonSerializerOptions?)null),
            value => JsonSerializer.Deserialize<List<string>>(value, (JsonSerializerOptions?)null) ?? new List<string>());
        var comparer = new ValueComparer<List<string>>(
            (left, right) => left!.SequenceEqual(right!),
            value => value.Aggregate(0, (hash, item) => HashCode.Combine(hash, item.GetHashCode())),
            value => value.ToList());
        property.HasConversion(converter);
        property.Metadata.SetValueComparer(comparer);
    }
}
