/**
 * OpenAPI spec generation script.
 * Generates openapi.json to dist/openapi.json without starting the server.
 * Run: ts-node -r tsconfig-paths/register scripts/generate-spec.ts
 */

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AppModule } from '../src/app/app.module';

async function generateSpec(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });

  app.enableVersioning({ type: VersioningType.URI });

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

  const outputDir = join(__dirname, '..', 'dist');
  const outputPath = join(outputDir, 'openapi.json');

  try {
    const { mkdirSync } = await import('node:fs');
    mkdirSync(outputDir, { recursive: true });
  } catch {
    // ignore mkdir errors
  }

  writeFileSync(outputPath, JSON.stringify(document, null, 2));
  console.log(`[generate-spec] OpenAPI spec written to ${outputPath}`);

  await app.close();
}

generateSpec().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[generate-spec] Failed: ${message}`);
  process.exit(1);
});
