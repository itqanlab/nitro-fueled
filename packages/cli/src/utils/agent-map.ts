export interface AgentMapping {
  language: string;
  framework: string | null;
  agentName: string;
  agentTitle: string;
}

export const AGENT_MAP: readonly AgentMapping[] = [
  { language: 'nodejs', framework: 'nextjs', agentName: 'nitro-nextjs-developer', agentTitle: 'Next.js Developer' },
  { language: 'nodejs', framework: 'angular', agentName: 'nitro-angular-developer', agentTitle: 'Angular Developer' },
  { language: 'nodejs', framework: 'react', agentName: 'nitro-react-developer', agentTitle: 'React Developer' },
  { language: 'nodejs', framework: 'vue', agentName: 'nitro-vue-developer', agentTitle: 'Vue Developer' },
  { language: 'nodejs', framework: 'nuxt', agentName: 'nitro-nuxt-developer', agentTitle: 'Nuxt Developer' },
  { language: 'nodejs', framework: 'svelte', agentName: 'nitro-svelte-developer', agentTitle: 'Svelte Developer' },
  { language: 'nodejs', framework: 'nestjs', agentName: 'nitro-nestjs-developer', agentTitle: 'NestJS Developer' },
  { language: 'nodejs', framework: 'fastify', agentName: 'nitro-fastify-developer', agentTitle: 'Fastify Developer' },
  { language: 'nodejs', framework: 'express', agentName: 'nitro-express-developer', agentTitle: 'Express Developer' },
  { language: 'nodejs', framework: 'electron', agentName: 'nitro-electron-developer', agentTitle: 'Electron Developer' },
  { language: 'nodejs', framework: 'tauri', agentName: 'nitro-tauri-developer', agentTitle: 'Tauri Developer' },
  { language: 'nodejs', framework: null, agentName: 'nitro-typescript-developer', agentTitle: 'TypeScript Developer' },
  { language: 'python', framework: 'django', agentName: 'nitro-django-developer', agentTitle: 'Django Developer' },
  { language: 'python', framework: 'fastapi', agentName: 'nitro-fastapi-developer', agentTitle: 'FastAPI Developer' },
  { language: 'python', framework: 'flask', agentName: 'nitro-flask-developer', agentTitle: 'Flask Developer' },
  { language: 'python', framework: 'pytorch', agentName: 'nitro-ml-developer', agentTitle: 'ML/AI Developer' },
  { language: 'python', framework: 'tensorflow', agentName: 'nitro-ml-developer', agentTitle: 'ML/AI Developer' },
  { language: 'python', framework: null, agentName: 'nitro-python-developer', agentTitle: 'Python Developer' },
  { language: 'java', framework: 'spring-boot', agentName: 'nitro-spring-developer', agentTitle: 'Spring Boot Developer' },
  { language: 'java', framework: 'android', agentName: 'nitro-android-developer', agentTitle: 'Android Developer' },
  { language: 'java', framework: null, agentName: 'nitro-java-developer', agentTitle: 'Java Developer' },
  { language: 'go', framework: null, agentName: 'nitro-go-developer', agentTitle: 'Go Developer' },
  { language: 'rust', framework: null, agentName: 'nitro-rust-developer', agentTitle: 'Rust Developer' },
  { language: 'ruby', framework: 'rails', agentName: 'nitro-rails-developer', agentTitle: 'Rails Developer' },
  { language: 'ruby', framework: null, agentName: 'nitro-ruby-developer', agentTitle: 'Ruby Developer' },
  { language: 'csharp', framework: 'aspnet', agentName: 'nitro-dotnet-developer', agentTitle: '.NET Developer' },
  { language: 'csharp', framework: null, agentName: 'nitro-dotnet-developer', agentTitle: '.NET Developer' },
  { language: 'php', framework: 'laravel', agentName: 'nitro-laravel-developer', agentTitle: 'Laravel Developer' },
  { language: 'php', framework: 'symfony', agentName: 'nitro-symfony-developer', agentTitle: 'Symfony Developer' },
  { language: 'php', framework: null, agentName: 'nitro-php-developer', agentTitle: 'PHP Developer' },
  { language: 'dart', framework: 'flutter', agentName: 'nitro-flutter-developer', agentTitle: 'Flutter Developer' },
  { language: 'dart', framework: null, agentName: 'nitro-dart-developer', agentTitle: 'Dart Developer' },
  { language: 'swift', framework: null, agentName: 'nitro-ios-developer', agentTitle: 'iOS Developer' },
  // Cross-language domain agents (matched by presence markers, not language)
  { language: '_design', framework: null, agentName: 'nitro-ui-ux-designer', agentTitle: 'UI/UX Designer' },
  { language: '_data-science', framework: null, agentName: 'nitro-data-science-developer', agentTitle: 'Data Science Developer' },
  { language: '_infrastructure', framework: 'terraform', agentName: 'nitro-terraform-developer', agentTitle: 'Terraform Developer' },
  { language: '_infrastructure', framework: 'kubernetes', agentName: 'nitro-kubernetes-developer', agentTitle: 'Kubernetes Developer' },
  { language: '_infrastructure', framework: 'docker', agentName: 'nitro-docker-developer', agentTitle: 'Docker Developer' },
  { language: '_infrastructure', framework: null, agentName: 'nitro-devops-developer', agentTitle: 'DevOps Developer' },
];
