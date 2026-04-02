// @ts-nocheck

import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { TaskIdParamDto } from '../../../dist/app/dtos/requests/task-id.param.dto';

describe('TaskIdParamDto', () => {
  describe('validation with valid formats', () => {
    it('should validate correct TASK_YYYY_NNN format', async () => {
      const dto = plainToInstance(TaskIdParamDto, { id: 'TASK_2026_001' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate TASK_2026_999 (max task number)', async () => {
      const dto = plainToInstance(TaskIdParamDto, { id: 'TASK_2026_999' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate TASK_0000_001 (min year)', async () => {
      const dto = plainToInstance(TaskIdParamDto, { id: 'TASK_0000_001' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate TASK_9999_001 (max year)', async () => {
      const dto = plainToInstance(TaskIdParamDto, { id: 'TASK_9999_001' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate TASK_2026_000 (min task number)', async () => {
      const dto = plainToInstance(TaskIdParamDto, { id: 'TASK_2026_000' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('validation with invalid formats', () => {
    it('should reject lowercase task prefix', async () => {
      const dto = plainToInstance(TaskIdParamDto, { id: 'task_2026_001' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('matches');
    });

    it('should reject missing underscore between parts', async () => {
      const dto = plainToInstance(TaskIdParamDto, { id: 'TASK2026_001' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('matches');
    });

    it('should reject non-digit characters in year', async () => {
      const dto = plainToInstance(TaskIdParamDto, { id: 'TASK_2A26_001' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('matches');
    });

    it('should reject 3-digit year', async () => {
      const dto = plainToInstance(TaskIdParamDto, { id: 'TASK_126_001' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('matches');
    });

    it('should reject 5-digit year', async () => {
      const dto = plainToInstance(TaskIdParamDto, { id: 'TASK_20261_001' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('matches');
    });

    it('should reject 2-digit task number', async () => {
      const dto = plainToInstance(TaskIdParamDto, { id: 'TASK_2026_01' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('matches');
    });

    it('should reject 4-digit task number', async () => {
      const dto = plainToInstance(TaskIdParamDto, { id: 'TASK_2026_0001' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('matches');
    });

    it('should reject non-digit characters in task number', async () => {
      const dto = plainToInstance(TaskIdParamDto, { id: 'TASK_2026_00A' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('matches');
    });

    it('should reject missing year part', async () => {
      const dto = plainToInstance(TaskIdParamDto, { id: 'TASK_001' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('matches');
    });

    it('should reject missing task number part', async () => {
      const dto = plainToInstance(TaskIdParamDto, { id: 'TASK_2026' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('matches');
    });

    it('should reject empty string', async () => {
      const dto = plainToInstance(TaskIdParamDto, { id: '' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject extra characters after format', async () => {
      const dto = plainToInstance(TaskIdParamDto, { id: 'TASK_2026_001_extra' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('matches');
    });
  });

  describe('security edge cases', () => {
    it('should reject path traversal attempt with ../', async () => {
      const dto = plainToInstance(TaskIdParamDto, { id: 'TASK_2026_001/../../etc/passwd' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('matches');
    });

    it('should reject null bytes', async () => {
      const dto = plainToInstance(TaskIdParamDto, { id: 'TASK_2026_\0' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('matches');
    });

    it('should reject SQL injection pattern', async () => {
      const dto = plainToInstance(TaskIdParamDto, { id: "TASK_2026_001' OR '1'='1" });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('matches');
    });

    it('should reject XSS attempt', async () => {
      const dto = plainToInstance(TaskIdParamDto, { id: 'TASK_2026_001<script>alert(1)</script>' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('matches');
    });

    it('should reject Unicode characters', async () => {
      const dto = plainToInstance(TaskIdParamDto, { id: 'TASK_20二六_001' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('matches');
    });

    it('should reject emoji', async () => {
      const dto = plainToInstance(TaskIdParamDto, { id: 'TASK_2026_001🔥' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('matches');
    });

    it('should reject control characters', async () => {
      const dto = plainToInstance(TaskIdParamDto, { id: 'TASK_2026_001\n' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('matches');
    });
  });

  describe('type validation', () => {
    it('should reject non-string values', async () => {
      const dto = plainToInstance(TaskIdParamDto, { id: 2026001 });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should reject null', async () => {
      const dto = plainToInstance(TaskIdParamDto, { id: null });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject undefined', async () => {
      const dto = plainToInstance(TaskIdParamDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject number as string', async () => {
      const dto = plainToInstance(TaskIdParamDto, { id: '2026001' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('matches');
    });
  });

  describe('property mapping', () => {
    it('should map id property correctly', async () => {
      const dto = plainToInstance(TaskIdParamDto, { id: 'TASK_2026_001' });
      expect(dto.id).toBe('TASK_2026_001');
    });

    it('should be read-only after validation', async () => {
      const dto = plainToInstance(TaskIdParamDto, { id: 'TASK_2026_001' });
      await validate(dto);
      expect(dto.id).toBe('TASK_2026_001');
    });
  });
});
