# Stack Detection Registry

Structured reference mapping manifest files and patterns to tech stack identifiers. Consumed by the `/create-agent` command and the CLI `init` flow to detect what technologies a project uses.

## How to Use This File

1. Scan the project root (and workspace roots for monorepos) for manifest files listed in **Language Detection Rules**
2. When a manifest is found, read its contents and check **Framework Detection Rules** for the matching language
3. Check **Infrastructure Detection Rules** and **Database Detection Rules** for supporting technologies
4. Check **Monorepo Indicators** to determine workspace scanning strategy
5. Use **Stack-to-Agent Mapping** to determine which developer agents to generate

Confidence levels: **high** = file is definitive for that stack; **medium** = common but shared across stacks; **low** = suggestive, needs content pattern confirmation.

---

## Language Detection Rules

| Manifest File | Stack ID | Category | Confidence | Content Patterns |
|---------------|----------|----------|------------|------------------|
| `package.json` | `nodejs` | Language | high | `"dependencies"` or `"devDependencies"` present |
| `tsconfig.json` | `typescript` | Language | high | Confirms TypeScript on top of Node.js |
| `requirements.txt` | `python` | Language | high | pip dependency list |
| `pyproject.toml` | `python` | Language | high | `[tool.poetry]` or `[project]` section |
| `Pipfile` | `python` | Language | high | Pipenv lockfile |
| `setup.py` | `python` | Language | medium | May be legacy; check for `install_requires` |
| `pom.xml` | `java` | Language | high | `<groupId>` and `<artifactId>` present |
| `build.gradle` | `java` | Language | high | `plugins` or `dependencies` block |
| `build.gradle.kts` | `kotlin` | Language | high | Kotlin DSL build file |
| `Package.swift` | `swift` | Language | high | `import PackageDescription` |
| `*.xcodeproj` | `swift-ios` | Language | high | Xcode project directory |
| `pubspec.yaml` | `dart` | Language | high | `dependencies:` section |
| `go.mod` | `go` | Language | high | `module` directive present |
| `Cargo.toml` | `rust` | Language | high | `[package]` with `name` and `version` |
| `Gemfile` | `ruby` | Language | high | `source` and `gem` declarations |
| `*.csproj` | `csharp` | Language | high | `<Project Sdk="Microsoft.NET.Sdk">` |
| `*.sln` | `csharp` | Language | medium | Solution file; confirms .NET project |
| `composer.json` | `php` | Language | high | `"require"` section present |

---

## Framework Detection Rules

### Node.js / TypeScript Frameworks

| Dependency / Pattern | Framework ID | Confidence | Content Pattern |
|----------------------|-------------|------------|-----------------|
| `react` in dependencies | `react` | high | `"react":` in package.json |
| `next` in dependencies | `nextjs` | high | `"next":` in package.json |
| `@angular/core` in dependencies | `angular` | high | `"@angular/core":` in package.json |
| `vue` in dependencies | `vue` | high | `"vue":` in package.json |
| `nuxt` in dependencies | `nuxt` | high | `"nuxt":` in package.json |
| `svelte` in dependencies | `svelte` | high | `"svelte":` in package.json |
| `express` in dependencies | `express` | high | `"express":` in package.json |
| `fastify` in dependencies | `fastify` | high | `"fastify":` in package.json |
| `@nestjs/core` in dependencies | `nestjs` | high | `"@nestjs/core":` in package.json |
| `electron` in dependencies | `electron` | high | `"electron":` in package.json |
| `@tauri-apps/api` in dependencies | `tauri` | high | `"@tauri-apps/api":` in package.json |

### Python Frameworks

| Dependency / Pattern | Framework ID | Confidence | Content Pattern |
|----------------------|-------------|------------|-----------------|
| `django` in requirements | `django` | high | `django` or `Django` in deps |
| `flask` in requirements | `flask` | high | `flask` or `Flask` in deps |
| `fastapi` in requirements | `fastapi` | high | `fastapi` in deps |
| `pytorch` or `torch` in requirements | `pytorch` | high | `torch` in deps |
| `tensorflow` in requirements | `tensorflow` | high | `tensorflow` in deps |

### Java / Kotlin Frameworks

| Dependency / Pattern | Framework ID | Confidence | Content Pattern |
|----------------------|-------------|------------|-----------------|
| `spring-boot` in pom/gradle | `spring-boot` | high | `org.springframework.boot` in build file |
| `quarkus` in pom/gradle | `quarkus` | high | `io.quarkus` in build file |
| `micronaut` in pom/gradle | `micronaut` | high | `io.micronaut` in build file |
| `android` plugin in gradle | `android` | high | `com.android.application` in plugins |

### Dart / Flutter

| Dependency / Pattern | Framework ID | Confidence | Content Pattern |
|----------------------|-------------|------------|-----------------|
| `flutter` in pubspec.yaml | `flutter` | high | `flutter:` under `dependencies` |

### Ruby Frameworks

| Dependency / Pattern | Framework ID | Confidence | Content Pattern |
|----------------------|-------------|------------|-----------------|
| `rails` in Gemfile | `rails` | high | `gem 'rails'` or `gem "rails"` |
| `sinatra` in Gemfile | `sinatra` | high | `gem 'sinatra'` or `gem "sinatra"` |

### C# / .NET Frameworks

| Dependency / Pattern | Framework ID | Confidence | Content Pattern |
|----------------------|-------------|------------|-----------------|
| `Microsoft.AspNetCore` in csproj | `aspnet` | high | `<PackageReference Include="Microsoft.AspNetCore` |
| `Xamarin` in csproj | `xamarin` | high | `Xamarin.Forms` in PackageReference |
| `MAUI` in csproj | `maui` | high | `Microsoft.Maui` in PackageReference |

### PHP Frameworks

| Dependency / Pattern | Framework ID | Confidence | Content Pattern |
|----------------------|-------------|------------|-----------------|
| `laravel/framework` in composer.json | `laravel` | high | `"laravel/framework":` in require |
| `symfony/framework-bundle` in composer.json | `symfony` | high | `"symfony/framework-bundle":` in require |

### Go Frameworks

| Dependency / Pattern | Framework ID | Confidence | Content Pattern |
|----------------------|-------------|------------|-----------------|
| `github.com/gin-gonic/gin` in go.mod | `gin` | high | `gin-gonic/gin` in require |
| `github.com/gofiber/fiber` in go.mod | `fiber` | high | `gofiber/fiber` in require |

### Rust Frameworks

| Dependency / Pattern | Framework ID | Confidence | Content Pattern |
|----------------------|-------------|------------|-----------------|
| `actix-web` in Cargo.toml | `actix` | high | `actix-web` under `[dependencies]` |
| `rocket` in Cargo.toml | `rocket` | high | `rocket` under `[dependencies]` |
| `tauri` in Cargo.toml | `tauri-rust` | high | `tauri` under `[dependencies]` |

---

## Infrastructure Detection Rules

| File Pattern | Infrastructure ID | Category | Confidence |
|-------------|-------------------|----------|------------|
| `Dockerfile` | `docker` | Container | high |
| `docker-compose.yml` / `docker-compose.yaml` | `docker-compose` | Container | high |
| `.github/workflows/*.yml` | `github-actions` | CI/CD | high |
| `.gitlab-ci.yml` | `gitlab-ci` | CI/CD | high |
| `Jenkinsfile` | `jenkins` | CI/CD | high |
| `.circleci/config.yml` | `circleci` | CI/CD | high |
| `terraform/*.tf` | `terraform` | IaC | high |
| `pulumi/*.ts` / `Pulumi.yaml` | `pulumi` | IaC | high |
| `serverless.yml` | `serverless` | Cloud | high |
| `vercel.json` | `vercel` | Hosting | high |
| `netlify.toml` | `netlify` | Hosting | high |
| `fly.toml` | `fly` | Hosting | high |
| `kubernetes/*.yaml` / `k8s/*.yaml` | `kubernetes` | Orchestration | medium |

---

## Database Detection Rules

| Config Pattern | Database ID | Confidence | Content Pattern |
|---------------|------------|------------|-----------------|
| `prisma/schema.prisma` | `prisma` | high | `datasource` block with provider |
| `drizzle.config.ts` | `drizzle` | high | Drizzle ORM config |
| `knexfile.js` / `knexfile.ts` | `knex` | high | Knex migration config |
| `ormconfig.json` / `ormconfig.ts` | `typeorm` | high | TypeORM config |
| `migrations/*.sql` | `sql-migrations` | medium | Raw SQL migration files |
| `mongod.conf` / `mongoose` in deps | `mongodb` | high | MongoDB config or Mongoose dependency |
| `redis.conf` / `ioredis` in deps | `redis` | medium | Redis config or client dependency |
| `firebase.json` | `firebase` | high | Firebase project config |
| `supabase/config.toml` | `supabase` | high | Supabase local config |

---

## Monorepo Indicators

| File Pattern | Workspace Type | Confidence | Scan Strategy |
|-------------|---------------|------------|---------------|
| `nx.json` | Nx | high | Read `workspace.json` or `project.json` per package |
| `"workspaces"` in package.json | Yarn/npm workspaces | high | Glob workspace patterns for sub-manifests |
| `pnpm-workspace.yaml` | pnpm workspaces | high | Read `packages` list for sub-manifests |
| `lerna.json` | Lerna | high | Read `packages` glob patterns |
| `turbo.json` | Turborepo | high | Uses workspace detection from npm/yarn/pnpm |
| `WORKSPACE` / `BUILD.bazel` | Bazel | high | Read `BUILD` files per package |
| `Cargo.toml` with `[workspace]` | Cargo workspace | high | Read `members` list for sub-crates |
| `settings.gradle` with `include` | Gradle multi-project | high | Read `include` directives for subprojects |
| `go.work` | Go workspace | high | Read `use` directives for module paths |

---

## Stack-to-Agent Mapping

| Stack ID | Recommended Agent Name | Agent Title |
|----------|----------------------|-------------|
| `nodejs` + `react` | `react-developer` | React Developer |
| `nodejs` + `nextjs` | `nextjs-developer` | Next.js Developer |
| `nodejs` + `angular` | `angular-developer` | Angular Developer |
| `nodejs` + `vue` | `vue-developer` | Vue Developer |
| `nodejs` + `express` | `express-developer` | Express Developer |
| `nodejs` + `nestjs` | `nestjs-developer` | NestJS Developer |
| `nodejs` + `electron` | `electron-developer` | Electron Developer |
| `typescript` (no framework) | `typescript-developer` | TypeScript Developer |
| `python` + `django` | `django-developer` | Django Developer |
| `python` + `fastapi` | `fastapi-developer` | FastAPI Developer |
| `python` + `flask` | `flask-developer` | Flask Developer |
| `python` + `pytorch` | `ml-developer` | ML/AI Developer |
| `python` (no framework) | `python-developer` | Python Developer |
| `java` + `spring-boot` | `spring-developer` | Spring Boot Developer |
| `java` + `android` | `android-developer` | Android Developer |
| `kotlin` + `android` | `android-developer` | Android Developer |
| `swift` / `swift-ios` | `ios-developer` | iOS Developer |
| `dart` + `flutter` | `flutter-developer` | Flutter Developer |
| `go` (any) | `go-developer` | Go Developer |
| `rust` (any) | `rust-developer` | Rust Developer |
| `ruby` + `rails` | `rails-developer` | Rails Developer |
| `csharp` + `aspnet` | `dotnet-developer` | .NET Developer |
| `php` + `laravel` | `laravel-developer` | Laravel Developer |
| `php` + `symfony` | `symfony-developer` | Symfony Developer |

**Mapping Rules:**
- When both language and framework are detected, use the framework-specific agent
- When only a language is detected (no framework), use the language-level agent
- Monorepo projects may produce multiple agents (one per workspace with distinct stacks)
- Infrastructure and database detections inform agent content but do not generate separate agents
