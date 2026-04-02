import { API_PROVIDER_OPTIONS, getProviderById, getProviderByName, detectProviderFromKey, maskApiKey } from './settings-provider.constants';
import { ApiProviderId, ApiProviderOption } from '../models/settings.model';

describe('settings-provider.constants', () => {
  describe('API_PROVIDER_OPTIONS', () => {
    it('should contain all expected providers', () => {
      expect(API_PROVIDER_OPTIONS.length).toBe(5);
      expect(API_PROVIDER_OPTIONS[0].id).toBe('anthropic');
      expect(API_PROVIDER_OPTIONS[1].id).toBe('openai');
      expect(API_PROVIDER_OPTIONS[2].id).toBe('google');
      expect(API_PROVIDER_OPTIONS[3].id).toBe('mistral');
      expect(API_PROVIDER_OPTIONS[4].id).toBe('groq');
    });

    it('should have correct model IDs for each provider', () => {
      const anthropic = API_PROVIDER_OPTIONS.find(p => p.id === 'anthropic');
      expect(anthropic?.modelIds).toEqual(['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001']);
      
      const openai = API_PROVIDER_OPTIONS.find(p => p.id === 'openai');
      expect(openai?.modelIds).toEqual(['gpt-4o', 'gpt-4o-mini', 'o1-preview', 'o3-mini']);
      
      const google = API_PROVIDER_OPTIONS.find(p => p.id === 'google');
      expect(google?.modelIds).toEqual(['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-1.5-pro']);
      
      const mistral = API_PROVIDER_OPTIONS.find(p => p.id === 'mistral');
      expect(mistral?.modelIds).toEqual(['mistral-large-latest', 'mistral-medium-latest', 'codestral-latest']);
      
      const groq = API_PROVIDER_OPTIONS.find(p => p.id === 'groq');
      expect(groq?.modelIds).toEqual(['llama-3.3-70b-versatile', 'mixtral-8x7b-32768', 'gemma2-9b-it']);
    });
  });

  describe('getProviderById', () => {
    it('should return provider for valid ID', () => {
      const provider = getProviderById('anthropic');
      expect(provider?.id).toBe('anthropic');
      expect(provider?.name).toBe('Anthropic');
    });

    it('should return null for invalid ID', () => {
      const provider = getProviderById('invalid-id' as ApiProviderId);
      expect(provider).toBeNull();
    });

    it('should return null for null ID', () => {
      const provider = getProviderById(null);
      expect(provider).toBeNull();
    });
  });

  describe('getProviderByName', () => {
    it('should return provider for valid name', () => {
      const provider = getProviderByName('Anthropic');
      expect(provider?.id).toBe('anthropic');
      expect(provider?.name).toBe('Anthropic');
    });

    it('should return null for invalid name', () => {
      const provider = getProviderByName('Invalid Name');
      expect(provider).toBeNull();
    });
  });

  describe('detectProviderFromKey', () => {
    it('should detect Anthropic provider from key', () => {
      const provider = detectProviderFromKey('sk-ant-test-key');
      expect(provider?.id).toBe('anthropic');
    });

    it('should detect OpenAI provider from key', () => {
      const provider = detectProviderFromKey('sk-test-key');
      expect(provider?.id).toBe('openai');
    });

    it('should detect Google provider from key', () => {
      const provider = detectProviderFromKey('AIzaTestKey');
      expect(provider?.id).toBe('google');
    });

    it('should detect Mistral provider from key', () => {
      const provider = detectProviderFromKey('mistral-test-key');
      expect(provider?.id).toBe('mistral');
    });

    it('should detect Groq provider from key', () => {
      const provider = detectProviderFromKey('gsk_test_key');
      expect(provider?.id).toBe('groq');
    });

    it('should return null for unknown key format', () => {
      const provider = detectProviderFromKey('unknown-key-format');
      expect(provider).toBeNull();
    });

    it('should handle empty key', () => {
      const provider = detectProviderFromKey('');
      expect(provider).toBeNull();
    });
  });

  describe('maskApiKey', () => {
    it('should mask short keys (<= 4 characters)', () => {
      expect(maskApiKey('123')).toBe('***');
      expect(maskApiKey('1234')).toBe('****');
    });

    it('should mask medium keys (5-12 characters)', () => {
      expect(maskApiKey('12345')).toBe('**345');
      expect(maskApiKey('123456')).toBe('***456');
      expect(maskApiKey('12345678')).toBe('****5678');
      expect(maskApiKey('1234567890')).toBe('******90');
      expect(maskApiKey('12345678901')).toBe('*******01');
      expect(maskApiKey('123456789012')).toBe('********12');
    });

    it('should mask long keys (> 12 characters)', () => {
      expect(maskApiKey('1234567890123')).toBe('12******23');
      expect(maskApiKey('12345678901234')).toBe('12*******34');
      expect(maskApiKey('123456789012345')).toBe('12********45');
      expect(maskApiKey('1234567890123456')).toBe('12*********56');
    });

    it('should handle empty string', () => {
      expect(maskApiKey('')).toBe('');
    });

    it('should handle whitespace', () => {
      expect(maskApiKey('  ')).toBe('  ');
    });
  });
});