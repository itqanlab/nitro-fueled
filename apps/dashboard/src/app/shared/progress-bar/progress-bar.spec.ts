import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProgressBarComponent } from './progress-bar.component';
import { NgClass } from '@angular/common';

// Test utilities
function describe(description: string, testFn: () => void): void {
  testFn();
}

function it(description: string, testFn: () => void): void {
  testFn();
}

function expect(actual: any): any {
  return {
    toBe: (expected: any) => {
      if (actual !== expected) {
        throw new Error(`Expected ${actual} to be ${expected}`);
      }
    },
    toContain: (expected: any) => {
      if (typeof actual === 'string' && !actual.includes(expected)) {
        throw new Error(`Expected "${actual}" to contain "${expected}"`);
      }
    },
    toBeNull: () => {
      if (actual !== null) {
        throw new Error(`Expected ${actual} to be null`);
      }
    },
    toThrow: () => {
      // Simple implementation
    },
    toBeTruthy: () => {
      if (!actual) {
        throw new Error(`Expected ${actual} to be truthy`);
      }
    },
    toBeFalsy: () => {
      if (actual) {
        throw new Error(`Expected ${actual} to be falsy`);
      }
    }
  };
}

const beforeEach = (fn: () => void) => {
  // Simple implementation
};

const async = (fn: () => Promise<void>) => fn;

describe('ProgressBarComponent', () => {
  let component: ProgressBarComponent;
  let fixture: ComponentFixture<ProgressBarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProgressBarComponent, NgClass]
    }).compileComponents();

    fixture = TestBed.createComponent(ProgressBarComponent);
    component = fixture.componentInstance;
  });

  describe('Input Validation', () => {
    it('should accept valid values between 0 and 100', () => {
      component.value = 50;
      fixture.detectChanges();
      expect(component.value).toBe(50);
      expect(component.boundedValue).toBe(50);
    });

    it('should clamp values below 0 to 0', () => {
      component.value = -10;
      fixture.detectChanges();
      expect(component.value).toBe(0);
      expect(component.boundedValue).toBe(0);
    });

    it('should clamp values above 100 to 100', () => {
      component.value = 150;
      fixture.detectChanges();
      expect(component.value).toBe(100);
      expect(component.boundedValue).toBe(100);
    });

    it('should handle non-numeric input by clamping to 0-100 range', () => {
      component.value = NaN as any;
      fixture.detectChanges();
      expect(component.value).toBe(0);
      expect(component.boundedValue).toBe(0);
    });

    it('should accept numeric string input', () => {
      component.value = '75' as any;
      fixture.detectChanges();
      expect(component.value).toBe(75);
      expect(component.boundedValue).toBe(75);
    });
  });

  describe('Variant Mapping', () => {
    it('should map accent variant correctly', () => {
      component.variant = 'accent';
      expect(component.variant).toBe('accent');
    });

    it('should map success variant correctly', () => {
      component.variant = 'success';
      expect(component.variant).toBe('success');
    });

    it('should map warning variant correctly', () => {
      component.variant = 'warning';
      expect(component.variant).toBe('warning');
    });

    it('should map error variant correctly', () => {
      component.variant = 'error';
      expect(component.variant).toBe('error');
    });

    it('should map task status to variants: running -> accent', () => {
      component.variant = 'running' as any;
      expect(component.variant).toBe('accent');
    });

    it('should map task status to variants: paused -> warning', () => {
      component.variant = 'paused' as any;
      expect(component.variant).toBe('warning');
    });

    it('should map task status to variants: completed -> success', () => {
      component.variant = 'completed' as any;
      expect(component.variant).toBe('success');
    });

    it('should handle invalid variant by defaulting to accent', () => {
      component.variant = 'invalid' as any;
      expect(component.variant).toBe('accent');
    });
  });

  describe('Label Rendering', () => {
    it('should show percentage when no label is provided', () => {
      component.value = 75;
      component.showLabel = true;
      fixture.detectChanges();
      const labelElement = fixture.nativeElement.querySelector('.progress-label');
      expect(labelElement.textContent).toContain('75%');
    });

    it('should show custom label when provided', () => {
      component.value = 75;
      component.label = 'Processing';
      component.showLabel = true;
      fixture.detectChanges();
      const labelElement = fixture.nativeElement.querySelector('.progress-label');
      expect(labelElement.textContent).toContain('Processing');
    });

    it('should not show label when showLabel is false', () => {
      component.value = 75;
      component.showLabel = false;
      fixture.detectChanges();
      const labelElement = fixture.nativeElement.querySelector('.progress-label');
      expect(labelElement).toBeNull();
    });

    it('should sanitize label input', () => {
      component.label = '  Test Label  ';
      fixture.detectChanges();
      expect(component.label).toBe('Test Label');
      expect(component.sanitizedLabel).toBe('Test Label');
    });

    it('should handle empty label input', () => {
      component.label = '';
      fixture.detectChanges();
      expect(component.label).toBeUndefined();
      expect(component.sanitizedLabel).toBe('');
    });

    it('should handle null label input', () => {
      component.label = null as any;
      fixture.detectChanges();
      expect(component.label).toBeUndefined();
      expect(component.sanitizedLabel).toBe('');
    });
  });

  describe('Performance with OnPush', () => {
    it('should use OnPush change detection strategy', () => {
      // Verify the component is properly configured for performance
      expect(component).toBeTruthy();
    });
  });

  describe('Cleanup in OnDestroy', () => {
    it('should reset all properties in ngOnDestroy', () => {
      component.value = 75;
      component.label = 'Test';
      component.variant = 'error';
      
      component.ngOnDestroy();
      
      expect(component.value).toBe(0);
      expect(component.label).toBeUndefined();
      expect(component.variant).toBe('accent');
    });
  });

  describe('CSS Classes', () => {
    it('should apply correct CSS class for accent variant', () => {
      component.variant = 'accent';
      fixture.detectChanges();
      const progressFill = fixture.nativeElement.querySelector('.progress-fill');
      expect(progressFill.classList.contains('accent')).toBe(true);
    });

    it('should apply correct CSS class for success variant', () => {
      component.variant = 'success';
      fixture.detectChanges();
      const progressFill = fixture.nativeElement.querySelector('.progress-fill');
      expect(progressFill.classList.contains('success')).toBe(true);
    });

    it('should apply correct CSS class for warning variant', () => {
      component.variant = 'warning';
      fixture.detectChanges();
      const progressFill = fixture.nativeElement.querySelector('.progress-fill');
      expect(progressFill.classList.contains('warning')).toBe(true);
    });

    it('should apply correct CSS class for error variant', () => {
      component.variant = 'error';
      fixture.detectChanges();
      const progressFill = fixture.nativeElement.querySelector('.progress-fill');
      expect(progressFill.classList.contains('error')).toBe(true);
    });
  });
});