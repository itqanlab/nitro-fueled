import { ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

class TestDto {
  public readonly name!: string;
  public readonly age!: number;
}

class StrictTestDto {
  public readonly name!: string;
}

describe('ValidationPipe Strict Mode', () => {
  let pipe: ValidationPipe;

  beforeEach(() => {
    pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    });
  });

  describe('whitelist: true behavior', () => {
    it('should strip unknown properties from input', async () => {
      const input = {
        name: 'John',
        age: 30,
        unknownProp: 'should be stripped',
      };
      const result = await pipe.transform(input, { type: 'body', metatype: TestDto });

      expect(result).toHaveProperty('name', 'John');
      expect(result).toHaveProperty('age', 30);
      expect(result).not.toHaveProperty('unknownProp');
    });

    it('should strip multiple unknown properties', async () => {
      const input = {
        name: 'John',
        age: 30,
        extra1: 'value1',
        extra2: 'value2',
        extra3: 'value3',
      };
      const result = await pipe.transform(input, { type: 'body', metatype: TestDto });

      expect(result).toHaveProperty('name', 'John');
      expect(result).toHaveProperty('age', 30);
      expect(result).not.toHaveProperty('extra1');
      expect(result).not.toHaveProperty('extra2');
      expect(result).not.toHaveProperty('extra3');
    });

    it('should keep all whitelisted properties', async () => {
      const input = {
        name: 'Alice',
        age: 25,
      };
      const result = await pipe.transform(input, { type: 'body', metatype: TestDto });

      expect(result).toHaveProperty('name', 'Alice');
      expect(result).toHaveProperty('age', 25);
    });
  });

  describe('forbidNonWhitelisted: true behavior', () => {
    it('should reject request with unknown properties', async () => {
      const input = {
        name: 'John',
        age: 30,
        hackerProp: 'malicious',
      };

      await expect(
        pipe.transform(input, { type: 'body', metatype: StrictTestDto }),
      ).rejects.toThrow();
    });

    it('should include all unknown properties in error', async () => {
      const input = {
        name: 'John',
        extra1: 'value1',
        extra2: 'value2',
      };

      try {
        await pipe.transform(input, { type: 'body', metatype: StrictTestDto });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
        expect(String(error)).toMatch(/extra1|extra2/);
      }
    });

    it('should reject deeply nested unknown properties', async () => {
      const input = {
        name: 'John',
        nested: { prop: 'value' },
      };

      await expect(
        pipe.transform(input, { type: 'body', metatype: StrictTestDto }),
      ).rejects.toThrow();
    });
  });

  describe('combined whitelist and forbidNonWhitelisted', () => {
    it('should allow valid payload with only whitelisted properties', async () => {
      const input = {
        name: 'Valid',
        age: 42,
      };

      const result = await pipe.transform(input, { type: 'body', metatype: TestDto });

      expect(result).toEqual(input);
    });

    it('should reject and report unknown properties', async () => {
      const input = {
        name: 'Invalid',
        age: 42,
        unauthorized: 'data',
      };

      await expect(
        pipe.transform(input, { type: 'body', metatype: TestDto }),
      ).rejects.toThrow();
    });

    it('should strip whitelisted but reject on forbid', async () => {
      const input = {
        name: 'Test',
        malicious: 'payload',
      };

      await expect(
        pipe.transform(input, { type: 'body', metatype: StrictTestDto }),
      ).rejects.toThrow();
    });
  });

  describe('type coercion and validation', () => {
    it('should perform type transformation', async () => {
      const input = {
        name: 'John',
        age: '30',
      };

      const result = await pipe.transform(input, { type: 'body', metatype: TestDto });

      expect(result.name).toBe('John');
      expect(result.age).toBe(30);
      expect(typeof result.age).toBe('number');
    });

    it('should handle numeric strings correctly', async () => {
      const input = {
        name: 'Alice',
        age: '25.5',
      };

      const result = await pipe.transform(input, { type: 'body', metatype: TestDto });

      expect(result.age).toBe(25.5);
    });
  });

  describe('edge cases', () => {
    it('should handle empty object', async () => {
      const input = {};
      const result = await pipe.transform(input, { type: 'body', metatype: TestDto });

      expect(result).toEqual({});
    });

    it('should handle null input', async () => {
      const input = null;
      const result = await pipe.transform(input, { type: 'body', metatype: TestDto });

      expect(result).toBeNull();
    });

    it('should handle undefined input', async () => {
      const input = undefined;
      const result = await pipe.transform(input, { type: 'body', metatype: TestDto });

      expect(result).toBeUndefined();
    });

    it('should handle array input', async () => {
      const input = [{ name: 'John' }];
      const result = await pipe.transform(input, { type: 'body', metatype: TestDto });

      expect(Array.isArray(result)).toBe(true);
    });

    it('should reject property with null value for known property', async () => {
      const input = {
        name: null,
        age: 30,
      };

      const result = await pipe.transform(input, { type: 'body', metatype: TestDto });

      expect(result.name).toBeNull();
    });
  });

  describe('security scenarios', () => {
    it('should reject mass assignment attempts', async () => {
      const input = {
        name: 'John',
        isAdmin: true,
        role: 'admin',
      };

      await expect(
        pipe.transform(input, { type: 'body', metatype: StrictTestDto }),
      ).rejects.toThrow();
    });

    it('should reject prototype pollution attempts', async () => {
      const input = {
        name: 'John',
        __proto__: { admin: true },
        constructor: { prototype: { admin: true } },
      };

      await expect(
        pipe.transform(input, { type: 'body', metatype: StrictTestDto }),
      ).rejects.toThrow();
    });

    it('should strip property injection attempts', async () => {
      const input = {
        name: 'John',
        'constructor.prototype.isAdmin': true,
      };

      await expect(
        pipe.transform(input, { type: 'body', metatype: StrictTestDto }),
      ).rejects.toThrow();
    });
  });

  describe('performance considerations', () => {
    it('should handle large payload efficiently', async () => {
      const largePayload: Record<string, unknown> = { name: 'Large', age: 50 };
      for (let i = 0; i < 100; i++) {
        largePayload[`extra${i}`] = `value${i}`;
      }

      await expect(
        pipe.transform(largePayload, { type: 'body', metatype: StrictTestDto }),
      ).rejects.toThrow();
    });

    it('should process valid payload quickly', async () => {
      const input = { name: 'Quick', age: 99 };
      const start = Date.now();
      await pipe.transform(input, { type: 'body', metatype: TestDto });
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
    });
  });
});
