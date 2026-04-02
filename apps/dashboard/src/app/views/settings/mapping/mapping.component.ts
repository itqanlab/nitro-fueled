import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { SettingsService } from '../../../services/settings.service';

@Component({
  selector: 'app-mapping',
  standalone: true,
  templateUrl: './mapping.component.html',
  styleUrl: './mapping.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MappingComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly settingsService = inject(SettingsService);
  private pendingTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.pendingTimer !== null) {
        clearTimeout(this.pendingTimer);
      }
    });
  }

  public readonly activeModels = this.settingsService.activeModels;
  public readonly activeLaunchers = this.settingsService.activeLaunchers;
  public readonly matrix = this.settingsService.mappingMatrix;
  public readonly defaultModel = this.settingsService.defaultModel;
  public readonly defaultLauncher = this.settingsService.defaultLauncher;
  public readonly saveMessage = signal<string | null>(null);

  public readonly hasData = computed(() => {
    return this.activeModels().length > 0 && this.activeLaunchers().length > 0;
  });

  public readonly selectedDefaultModel = computed(() => this.defaultModel() ?? '');
  public readonly selectedDefaultLauncher = computed(() => this.defaultLauncher() ?? '');

  public readonly modelOptions = computed(() =>
    this.activeModels().map((m) => m.modelId),
  );

  public readonly launcherOptions = computed(() =>
    this.activeLaunchers().map((l) => ({
      id: l.launcherId,
      name: l.launcherName,
    })),
  );

  public isCellEnabled(modelId: string, launcherId: string): boolean {
    return this.matrix().some(
      (c) => c.modelId === modelId && c.launcherId === launcherId && c.enabled,
    );
  }

  public isCellDefault(modelId: string, launcherId: string): boolean {
    return this.matrix().some(
      (c) => c.modelId === modelId && c.launcherId === launcherId && c.isDefault,
    );
  }

  public onToggleCell(modelId: string, launcherId: string): void {
    this.settingsService.toggleMapping(modelId, launcherId);
  }

  public onSetDefault(modelId: string, launcherId: string): void {
    this.settingsService.setDefaultMapping(modelId, launcherId);
  }

  public onDefaultModelChange(event: Event): void {
    if (!(event.target instanceof HTMLSelectElement)) {
      return;
    }

    const modelId = event.target.value;

    if (modelId.length > 0) {
      this.settingsService.setDefaultModel(modelId);
    }
  }

  public onDefaultLauncherChange(event: Event): void {
    if (!(event.target instanceof HTMLSelectElement)) {
      return;
    }

    const launcherId = event.target.value;

    if (launcherId.length > 0) {
      this.settingsService.setDefaultLauncher(launcherId);
    }
  }

  public onSave(): void {
    this.settingsService.saveMappings();
    this.saveMessage.set('Configuration saved (mock)');
    this.scheduleClearMessage();
  }

  public onReset(): void {
    if (!window.confirm('Reset all mappings to defaults?')) {
      return;
    }

    this.settingsService.resetMappings();
    this.saveMessage.set('Mappings reset to defaults');
    this.scheduleClearMessage();
  }

  private scheduleClearMessage(): void {
    if (this.pendingTimer !== null) {
      clearTimeout(this.pendingTimer);
    }
    this.pendingTimer = setTimeout(() => {
      this.saveMessage.set(null);
      this.pendingTimer = null;
    }, 3000);
  }
}
