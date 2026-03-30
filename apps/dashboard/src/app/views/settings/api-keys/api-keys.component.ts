import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { SettingsService } from '../../../services/settings.service';
import { ApiProviderId } from '../../../models/settings.model';

const EMPTY_VALUE = '';

@Component({
  selector: 'app-api-keys',
  standalone: true,
  templateUrl: './api-keys.component.html',
  styleUrl: './api-keys.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApiKeysComponent {
  private readonly settingsService = inject(SettingsService);

  public readonly providerOptions = this.settingsService.providerOptions;
  public readonly editingId = signal<string | null>(null);
  public readonly keyValue = signal(EMPTY_VALUE);
  public readonly labelValue = signal(EMPTY_VALUE);
  public readonly manualProviderId = signal<ApiProviderId | null>(null);
  public readonly apiKeys = computed(() =>
    this.settingsService.apiKeys().map((entry) => {
      const provider = entry.providerId !== undefined
        ? this.settingsService.getProviderById(entry.providerId)
        : this.settingsService.getProviderByName(entry.provider);

      return {
        ...entry,
        displayLabel: entry.label ?? `${entry.provider} key`,
        providerIcon: provider?.iconLabel ?? entry.provider.slice(0, 2),
      };
    }),
  );
  public readonly detectedProvider = computed(() => this.settingsService.detectProvider(this.keyValue()));
  public readonly selectedProvider = computed(() => {
    return this.detectedProvider() ?? this.settingsService.getProviderById(this.manualProviderId());
  });
  public readonly availableModels = computed(() => this.selectedProvider()?.modelIds ?? []);
  public readonly requiresManualProvider = computed(() => {
    return this.keyValue().trim().length > 0 && this.detectedProvider() === null;
  });
  public readonly canSave = computed(() => {
    const hasLabel = this.labelValue().trim().length > 0;
    const hasProvider = this.selectedProvider() !== null;

    if (this.editingId() !== null) {
      return hasLabel && hasProvider;
    }

    return hasLabel && hasProvider && this.keyValue().trim().length > 0;
  });
  public readonly formTitle = computed(() => {
    return this.editingId() === null ? 'Add API key' : 'Edit API key';
  });
  public readonly formDescription = computed(() => {
    if (this.detectedProvider() !== null) {
      return `Detected ${this.detectedProvider()?.name} from the key format.`;
    }

    if (this.requiresManualProvider()) {
      return 'Provider format was not recognized. Pick one manually to load mock models.';
    }

    return 'Paste a key to auto-detect its provider and preview the provider models.';
  });

  public onKeyInput(event: Event): void {
    this.keyValue.set(this.readInputValue(event));
  }

  public onLabelInput(event: Event): void {
    this.labelValue.set(this.readInputValue(event));
  }

  public onProviderChange(event: Event): void {
    const providerId = this.readInputValue(event);
    const selectedProvider = this.providerOptions.find((provider) => provider.id === providerId);

    this.manualProviderId.set(selectedProvider?.id ?? null);
  }

  public onSubmit(): void {
    const provider = this.selectedProvider();
    const label = this.labelValue().trim();

    if (provider === null || label.length === 0) {
      return;
    }

    const editingId = this.editingId();

    if (editingId === null) {
      this.settingsService.addApiKey(label, this.keyValue(), provider.id);
    } else {
      this.settingsService.updateApiKey(editingId, label, this.keyValue(), provider.id);
    }

    this.resetForm();
  }

  public onEdit(id: string): void {
    const entry = this.settingsService.apiKeys().find((apiKey) => apiKey.id === id);

    if (entry === undefined) {
      return;
    }

    this.editingId.set(entry.id);
    this.keyValue.set(EMPTY_VALUE);
    this.labelValue.set(entry.label ?? `${entry.provider} key`);
    this.manualProviderId.set(entry.providerId ?? this.settingsService.getProviderByName(entry.provider)?.id ?? null);
  }

  public onDelete(id: string, label: string): void {
    if (!window.confirm(`Delete ${label}?`)) {
      return;
    }

    this.settingsService.deleteApiKey(id);

    if (this.editingId() === id) {
      this.resetForm();
    }
  }

  public onToggle(id: string): void {
    this.settingsService.toggleActive('apiKey', id);
  }

  public onCancelEdit(): void {
    this.resetForm();
  }

  private readInputValue(event: Event): string {
    if (!(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLSelectElement)) {
      return EMPTY_VALUE;
    }

    return event.target.value;
  }

  private resetForm(): void {
    this.editingId.set(null);
    this.keyValue.set(EMPTY_VALUE);
    this.labelValue.set(EMPTY_VALUE);
    this.manualProviderId.set(null);
  }
}
