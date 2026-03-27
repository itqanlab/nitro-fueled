export interface AgentMapping {
  language: string;
  framework: string | null;
  agentName: string;
  agentTitle: string;
}

export const AGENT_MAP: readonly AgentMapping[] = [
  { language: 'nodejs', framework: 'nextjs', agentName: 'nextjs-developer', agentTitle: 'Next.js Developer' },
  { language: 'nodejs', framework: 'angular', agentName: 'angular-developer', agentTitle: 'Angular Developer' },
  { language: 'nodejs', framework: 'react', agentName: 'react-developer', agentTitle: 'React Developer' },
  { language: 'nodejs', framework: 'vue', agentName: 'vue-developer', agentTitle: 'Vue Developer' },
  { language: 'nodejs', framework: 'nuxt', agentName: 'nuxt-developer', agentTitle: 'Nuxt Developer' },
  { language: 'nodejs', framework: 'svelte', agentName: 'svelte-developer', agentTitle: 'Svelte Developer' },
  { language: 'nodejs', framework: 'nestjs', agentName: 'nestjs-developer', agentTitle: 'NestJS Developer' },
  { language: 'nodejs', framework: 'fastify', agentName: 'fastify-developer', agentTitle: 'Fastify Developer' },
  { language: 'nodejs', framework: 'express', agentName: 'express-developer', agentTitle: 'Express Developer' },
  { language: 'nodejs', framework: 'electron', agentName: 'electron-developer', agentTitle: 'Electron Developer' },
  { language: 'nodejs', framework: 'tauri', agentName: 'tauri-developer', agentTitle: 'Tauri Developer' },
  { language: 'nodejs', framework: null, agentName: 'typescript-developer', agentTitle: 'TypeScript Developer' },
  { language: 'python', framework: 'django', agentName: 'django-developer', agentTitle: 'Django Developer' },
  { language: 'python', framework: 'fastapi', agentName: 'fastapi-developer', agentTitle: 'FastAPI Developer' },
  { language: 'python', framework: 'flask', agentName: 'flask-developer', agentTitle: 'Flask Developer' },
  { language: 'python', framework: 'pytorch', agentName: 'ml-developer', agentTitle: 'ML/AI Developer' },
  { language: 'python', framework: 'tensorflow', agentName: 'ml-developer', agentTitle: 'ML/AI Developer' },
  { language: 'python', framework: null, agentName: 'python-developer', agentTitle: 'Python Developer' },
  { language: 'java', framework: 'spring-boot', agentName: 'spring-developer', agentTitle: 'Spring Boot Developer' },
  { language: 'java', framework: 'android', agentName: 'android-developer', agentTitle: 'Android Developer' },
  { language: 'java', framework: null, agentName: 'java-developer', agentTitle: 'Java Developer' },
  { language: 'go', framework: null, agentName: 'go-developer', agentTitle: 'Go Developer' },
  { language: 'rust', framework: null, agentName: 'rust-developer', agentTitle: 'Rust Developer' },
  { language: 'ruby', framework: 'rails', agentName: 'rails-developer', agentTitle: 'Rails Developer' },
  { language: 'ruby', framework: null, agentName: 'ruby-developer', agentTitle: 'Ruby Developer' },
  { language: 'csharp', framework: 'aspnet', agentName: 'dotnet-developer', agentTitle: '.NET Developer' },
  { language: 'csharp', framework: null, agentName: 'dotnet-developer', agentTitle: '.NET Developer' },
  { language: 'php', framework: 'laravel', agentName: 'laravel-developer', agentTitle: 'Laravel Developer' },
  { language: 'php', framework: 'symfony', agentName: 'symfony-developer', agentTitle: 'Symfony Developer' },
  { language: 'php', framework: null, agentName: 'php-developer', agentTitle: 'PHP Developer' },
  { language: 'dart', framework: 'flutter', agentName: 'flutter-developer', agentTitle: 'Flutter Developer' },
  { language: 'dart', framework: null, agentName: 'dart-developer', agentTitle: 'Dart Developer' },
  { language: 'swift', framework: null, agentName: 'ios-developer', agentTitle: 'iOS Developer' },
  // Cross-language domain agents (matched by presence markers, not language)
  { language: '_design', framework: null, agentName: 'nitro-ui-ux-designer', agentTitle: 'UI/UX Designer' },
  { language: '_data-science', framework: null, agentName: 'data-science-developer', agentTitle: 'Data Science Developer' },
  { language: '_infrastructure', framework: 'terraform', agentName: 'terraform-developer', agentTitle: 'Terraform Developer' },
  { language: '_infrastructure', framework: 'kubernetes', agentName: 'kubernetes-developer', agentTitle: 'Kubernetes Developer' },
  { language: '_infrastructure', framework: 'docker', agentName: 'docker-developer', agentTitle: 'Docker Developer' },
  { language: '_infrastructure', framework: null, agentName: 'devops-developer', agentTitle: 'DevOps Developer' },
];
