import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideNzConfig } from 'ng-zorro-antd/core/config';
import type { NzConfig } from 'ng-zorro-antd/core/config';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import {
  SearchOutline,
  BellOutline,
  SettingOutline,
} from '@ant-design/icons-angular/icons';
import { APP_ROUTES } from './app.routes';

const nzConfig: NzConfig = {
  theme: {
    primaryColor: '#177ddc',
  },
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(APP_ROUTES),
    provideAnimationsAsync(),
    provideNzI18n(en_US),
    provideNzConfig(nzConfig),
    provideNzIcons([SearchOutline, BellOutline, SettingOutline]),
    provideHttpClient(),
  ],
};
