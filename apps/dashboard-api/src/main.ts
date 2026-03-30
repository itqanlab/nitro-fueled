import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app/app.module';
import { ResponseEnvelopeInterceptor } from './app/interceptors/response-envelope.interceptor';
import { ErrorEnvelopeFilter } from './app/filters/error-envelope.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: /^https?:\/\/localhost(:\d+)?$/,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // Enable URI versioning: /api/v1/...
  app.enableVersioning({ type: VersioningType.URI });

  // Global interceptor — wraps all responses in { success, data, meta }
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());

  // Global filter — transforms all exceptions to { success: false, error, meta }
  app.useGlobalFilters(new ErrorEnvelopeFilter());

  // Swagger / OpenAPI documentation
  const config = new DocumentBuilder()
    .setTitle('Nitro-Fueled Dashboard API')
    .setDescription(
      'Internal dev-tool API for the Nitro-Fueled orchestration dashboard. ' +
        'Provides read-only access to task registry, orchestrator state, sessions, analytics, and knowledge base.',
    )
    .setVersion('1.0')
    .addTag('health', 'Health check endpoint')
    .addTag('registry', 'Task registry — list and filter all tasks')
    .addTag('plan', 'Project plan phases and current focus')
    .addTag('state', 'Live orchestrator state')
    .addTag('tasks', 'Full task data — definition, reviews, completion report')
    .addTag('workers', 'Active worker tree and status')
    .addTag('sessions', 'Session list and detail')
    .addTag('analytics', 'Cost, efficiency, model usage, and session analytics')
    .addTag('knowledge', 'Anti-patterns and review lessons')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Nitro-Fueled Dashboard API',
  });

  const port = process.env['PORT'] ? parseInt(process.env['PORT'], 10) : 0;
  await app.listen(port);

  const url = await app.getUrl();
  console.log(`[dashboard-api] Server running at ${url}`);
  console.log(`[dashboard-api] Swagger UI: ${url}/api/docs`);
}

bootstrap().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[dashboard-api] Failed to start: ${message}`);
  process.exit(1);
});
