import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly API_KEY_STORAGE = 'nitro_api_key';
  private readonly apiBase = environment.apiUrl;

  public readonly apiKey = signal<string | null>(
    localStorage.getItem(this.API_KEY_STORAGE),
  );

  public readonly isAuthenticated = computed(
    () => this.apiKey() !== null && this.apiKey()!.trim().length > 0,
  );

  public setApiKey(key: string): void {
    localStorage.setItem(this.API_KEY_STORAGE, key);
    this.apiKey.set(key);
  }

  public clearApiKey(): void {
    localStorage.removeItem(this.API_KEY_STORAGE);
    this.apiKey.set(null);
  }

  public verifyApiKey(key: string): Observable<boolean> {
    const headers = new HttpHeaders({ 'X-Api-Key': key });
    return this.http
      .get(`${this.apiBase}/api/v1/health`, { headers })
      .pipe(
        map(() => true),
        catchError(() => of(false)),
      );
  }
}
