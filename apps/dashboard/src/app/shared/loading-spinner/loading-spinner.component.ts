import { ChangeDetectionStrategy, Component, Input, OnDestroy, SecurityContext } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { NgClass } from '@angular/common';

type SpinnerSize = 'sm' | 'md' | 'lg';
type SpinnerMode = 'spinner' | 'skeleton';

@Component({
  selector: 'app-loading-spinner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass],
  template: `
    @if (mode === 'spinner') {
      <div class="spinner-container">
        <span class="spinner-icon" [ngClass]="size"></span>
        @if (text) {
          <span class="spinner-text" [innerHTML]="sanitizedText"></span>
        }
      </div>
    } @else {
      <div class="skeleton" [ngClass]="'skeleton-' + size"></div>
    }
  `,
  styles: [`
    .spinner-container {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .spinner-icon {
      border: 2px solid var(--border);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    .spinner-icon.sm {
      width: 16px;
      height: 16px;
      border-width: 2px;
    }
    .spinner-icon.md {
      width: 20px;
      height: 20px;
      border-width: 2px;
    }
    .spinner-icon.lg {
      width: 24px;
      height: 24px;
      border-width: 3px;
    }
    .spinner-text {
      font-size: 12px;
      color: var(--text-secondary);
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .skeleton {
      background: linear-gradient(90deg, var(--bg-tertiary) 25%, var(--bg-hover) 50%, var(--bg-tertiary) 75%);
      background-size: 200% 100%;
      animation: skeleton-shimmer 1.5s infinite;
      border-radius: var(--radius);
    }
    .skeleton.sm {
      height: 16px;
      width: 60px;
    }
    .skeleton.md {
      height: 20px;
      width: 120px;
    }
    .skeleton.lg {
      height: 24px;
      width: 200px;
    }
    @keyframes skeleton-shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `],
})
export class LoadingSpinnerComponent implements OnDestroy {
  constructor(private sanitizer: DomSanitizer) {}

  private _size: SpinnerSize = 'md';
  private _mode: SpinnerMode = 'spinner';
  private _text?: string;

  @Input() set size(val: SpinnerSize) {
    this._size = this.validateSize(val);
  }

  get size(): SpinnerSize {
    return this._size;
  }

  @Input() set mode(val: SpinnerMode) {
    this._mode = this.validateMode(val);
  }

  get mode(): SpinnerMode {
    return this._mode;
  }

  @Input() set text(val: string) {
    this._text = this.validateText(val);
  }

  get text(): string | undefined {
    return this._text;
  }

  get sanitizedText(): SafeHtml {
    if (!this._text) return '';
    return this.sanitizer.sanitize(SecurityContext.HTML, this._text) || '';
  }

  private validateSize(size: any): SpinnerSize {
    const validSizes: SpinnerSize[] = ['sm', 'md', 'lg'];
    return validSizes.includes(size) ? size : 'md';
  }

  private validateMode(mode: any): SpinnerMode {
    const validModes: SpinnerMode[] = ['spinner', 'skeleton'];
    return validModes.includes(mode) ? mode : 'spinner';
  }

  private validateText(text: any): string | undefined {
    if (text == null) return undefined;
    const str = String(text).trim();
    return str.length > 0 ? str : undefined;
  }

  ngOnDestroy(): void {
    this._size = 'md';
    this._mode = 'spinner';
    this._text = undefined;
  }
}
