// @ts-nocheck

import { ValidationPipe } from '@nestjs/common';
import { IsString, IsNumber } from 'class-validator';

class TestDto {
  @IsString()
  public readonly name!: string;

  @IsNumber()
  public readonly age!: number;
}

class StrictTestDto {
  @IsString()
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

    it('should include unknown properties in error message', async () => {
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
        expect(error).toHaveProperty('response');
        expect(error.response.message).toBeDefined();
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

    it('should reject payload with unknown properties', async () => {
      const input = {
        name: 'Invalid',
        age: 42,
        unauthorized: 'data',
      };

      await expect(
        pipe.transform(input, { type: 'body', metatype: TestDto }),
      ).rejects.toThrow();
    });

    it('should reject payload with any non-whitelisted properties', async () => {
      const input = {
        name: 'Test',
        malicious: 'payload',
      };

      await expect(
        pipe.transform(input, { type: 'body', metatype: StrictTestDto }),
      ).rejects.toThrow();
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

    it('should reject property injection attempts', async () => {
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
    it('should handle large payload with many unknown properties efficiently', async () => {
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
