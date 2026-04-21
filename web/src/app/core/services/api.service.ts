import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';

/**
 * Unwrap the backend's TransformInterceptor wrapper `{ statusCode, data, timestamp }`.
 * If the response has a `data` property and a `statusCode`, extract `data`.
 * Otherwise return the response as-is.
 */
function unwrap<T>(res: any): T {
  if (res && typeof res === 'object' && 'data' in res && 'statusCode' in res) {
    return res.data as T;
  }
  return res as T;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly baseUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  get<T>(path: string, params?: Record<string, string | number | boolean>): Observable<T> {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        httpParams = httpParams.set(key, String(value));
      });
    }
    return this.http
      .get<any>(`${this.baseUrl}${path}`, { params: httpParams })
      .pipe(map(unwrap<T>));
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<any>(`${this.baseUrl}${path}`, body).pipe(map(unwrap<T>));
  }

  patch<T>(path: string, body: unknown): Observable<T> {
    return this.http.patch<any>(`${this.baseUrl}${path}`, body).pipe(map(unwrap<T>));
  }

  delete<T>(path: string, options?: { body?: any }): Observable<T> {
    return this.http
      .delete<any>(`${this.baseUrl}${path}`, options ? { body: options.body } : undefined)
      .pipe(map(unwrap<T>));
  }
}
