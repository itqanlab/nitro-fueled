import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { LauncherType } from '../../../models/settings.model';
import { SettingsService } from '../../../services/settings.service';

const EMPTY_VALUE = '';
const LAUNCHER_TYPE_OPTIONS: readonly LauncherType[] = ['cli', 'ide', 'desktop'];
const LAUNCHER_TYPE_ICONS: Record<LauncherType, string> = { cli: '>_', ide: '[]', desktop: 'OS' };

@Component({
  selector: 'app-launchers',
  standalone: true,
  templateUrl: './launchers.component.html',
  styleUrl: './launchers.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LaunchersComponent {
  private readonly settingsService = inject(SettingsService);

  public readonly launcherTypeOptions = LAUNCHER_TYPE_OPTIONS;
  public readonly detectionEntries = this.settingsService.launcherDetections;
  public readonly launcherName = signal(EMPTY_VALUE);
  public readonly launcherType = signal<LauncherType>('cli');
  public readonly launcherPath = signal(EMPTY_VALUE);
  public readonly launchers = computed(() => this.settingsService.launchers().map((launcher) => ({
    ...launcher,
    typeIcon: LAUNCHER_TYPE_ICONS[launcher.type],
  })));
  public readonly canAddLauncher = computed(() => {
    return this.launcherName().trim().length > 0 && this.launcherPath().trim().length > 0;
  });

  public onNameInput(event: Event): void {
    this.launcherName.set(this.readInputValue(event));
  }

  public onTypeChange(event: Event): void {
    const value = this.readInputValue(event);

    if (value === 'cli' || value === 'ide' || value === 'desktop') {
      this.launcherType.set(value);
    }
  }

  public onPathInput(event: Event): void {
    this.launcherPath.set(this.readInputValue(event));
  }

  public onAddLauncher(): void {
    if (!this.canAddLauncher()) {
      return;
    }

    this.settingsService.addLauncher(this.launcherName(), this.launcherType(), this.launcherPath());
    this.launcherName.set(EMPTY_VALUE);
    this.launcherType.set('cli');
    this.launcherPath.set(EMPTY_VALUE);
  }

  public onToggle(id: string): void {
    this.settingsService.toggleActive('launcher', id);
  }

  private readInputValue(event: Event): string {
    if (!(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLSelectElement)) {
      return EMPTY_VALUE;
    }

    return event.target.value;
  }
}
