import { createRequire } from 'node:module';

const pkgRequire = createRequire(import.meta.url);

function hasVersion(obj: object): obj is { version: unknown } {
  return 'version' in obj;
}

export function getPackageVersion(): string {
  try {
    const pkg: unknown = pkgRequire('../../package.json');
    if (typeof pkg === 'object' && pkg !== null && hasVersion(pkg)) {
      const v = pkg.version;
      if (typeof v === 'string') return v;
    }
  } catch (err: unknown) {
    console.error(
      `Warning: could not read package.json version: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  return '0.0.0';
}
