import { ApiProviderId, ApiProviderOption } from '../models/settings.model';

export const API_PROVIDER_OPTIONS: readonly ApiProviderOption[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    iconLabel: 'A',
    modelIds: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    iconLabel: 'O',
    modelIds: ['gpt-4o', 'gpt-4o-mini', 'o1-preview', 'o3-mini'],
  },
  {
    id: 'google',
    name: 'Google',
    iconLabel: 'G',
    modelIds: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-1.5-pro'],
  },
  {
    id: 'mistral',
    name: 'Mistral',
    iconLabel: 'M',
    modelIds: ['mistral-large-latest', 'mistral-medium-latest', 'codestral-latest'],
  },
  {
    id: 'groq',
    name: 'Groq',
    iconLabel: 'Gr',
    modelIds: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
  },
];

export function getProviderById(providerId: ApiProviderId | null): ApiProviderOption | null {
  if (providerId === null) {
    return null;
  }

  return API_PROVIDER_OPTIONS.find((option) => option.id === providerId) ?? null;
}

export function getProviderByName(name: string): ApiProviderOption | null {
  return API_PROVIDER_OPTIONS.find((option) => option.name === name) ?? null;
}

export function detectProviderFromKey(keyValue: string): ApiProviderOption | null {
  const normalizedKey = keyValue.trim();

  if (/^sk-ant-/i.test(normalizedKey)) {
    return getProviderById('anthropic');
  }

  if (/^sk-(?!ant-)/i.test(normalizedKey)) {
    return getProviderById('openai');
  }

  if (/^AIza/i.test(normalizedKey)) {
    return getProviderById('google');
  }

  if (/^mistral-/i.test(normalizedKey)) {
    return getProviderById('mistral');
  }

  if (/^gsk_/i.test(normalizedKey)) {
    return getProviderById('groq');
  }

  return null;
}

export function maskApiKey(value: string): string {
  const trimmedValue = value.trim();
  const keyLength = trimmedValue.length;

  if (keyLength === 0) {
    return trimmedValue;
  }

  if (keyLength <= 4) {
    return '*'.repeat(keyLength);
  }

  if (keyLength <= 12) {
    return `${'*'.repeat(keyLength - 4)}${trimmedValue.slice(-4)}`;
  }

  return `${trimmedValue.slice(0, 2)}${'*'.repeat(keyLength - 6)}${trimmedValue.slice(-4)}`;
}
