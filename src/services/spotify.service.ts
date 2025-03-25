import { Injectable } from '@angular/core';
import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
  HttpParams,
} from '@angular/common/http';
import { environment } from '../environments/environment';
import {
  catchError,
  forkJoin,
  from,
  map,
  mergeMap,
  Observable,
  of,
  timeout,
} from 'rxjs';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

@Injectable({
  providedIn: 'root',
})
export class SpotifyLoginService {
  private clientId = environment.spotify.clientId;
  private clientSecret = environment.spotify.clientSecret;
  private redirectUri = Capacitor.isNativePlatform()
    ? 'myapp://spotify-callback' // per mobile (deep link)
    : environment.spotify.redirectUri; // per web

  private authEndpoint = 'https://accounts.spotify.com/authorize';
  private tokenEndpoint = 'https://accounts.spotify.com/api/token';
  private scope =
    'ugc-image-upload user-read-email user-read-private user-read-recently-played user-top-read user-read-playback-position user-read-playback-state user-modify-playback-state user-read-currently-playing app-remote-control streaming playlist-read-private playlist-read-collaborative playlist-modify-public playlist-modify-private user-follow-read user-follow-modify user-library-read user-library-modify';
  private apiUrl = 'https://api.spotify.com/v1';

  constructor(private http: HttpClient) {}

  /**
   * Restituisce l'URL di login per l'autenticazione su Spotify.
   */
  getLoginUrl(): string {
    const params = new HttpParams()
      .set('client_id', this.clientId)
      .set('response_type', 'code')
      .set('redirect_uri', this.redirectUri)
      .set('scope', this.scope)
      .set('state', this.generateRandomState())
      .set('show_dialog', 'true');

    return `${this.authEndpoint}?${params.toString()}`;
  }

  /**
   * Scambia il codice ricevuto per un access token e refresh token.
   */
  exchangeCodeForToken(code: string): Observable<any> {
    const body = new HttpParams()
      .set('grant_type', 'authorization_code')
      .set('code', code)
      .set('redirect_uri', this.redirectUri);

    const headers = this.getAuthHeaders();

    return this.http
      .post<any>(this.tokenEndpoint, body.toString(), { headers })
      .pipe(
        timeout(60000),
        mergeMap(response => {
          console.log('Token exchange response:', response);
          if (!response || !response['access_token']) {
            console.error('Token exchange response non valida:', response);
            throw new Error('Risposta token non valida');
          }
          return from(this.saveTokens(response)).pipe(map(() => response));
        }),
        catchError(error => {
          console.error('Errore nello scambio del codice per il token', error);
          return of(null);
        })
      );
  }

  /**
   * Prova a rinnovare l'access token usando il refresh token salvato.
   */
  refreshAccessToken(): Observable<string | null> {
    return from(Preferences.get({ key: 'spotifyRefreshToken' })).pipe(
      mergeMap(refreshTokenResult => {
        const refreshToken = refreshTokenResult.value;
        if (!refreshToken) {
          console.error('Nessun refresh token disponibile');
          return of(null);
        }

        const body = new HttpParams()
          .set('grant_type', 'refresh_token')
          .set('refresh_token', refreshToken);

        const headers = this.getAuthHeaders();

        return this.http
          .post<any>(this.tokenEndpoint, body.toString(), { headers })
          .pipe(
            mergeMap(response => {
              console.log('Refresh token response:', response);
              return from(this.saveTokens(response)).pipe(
                map(() => response.access_token)
              );
            }),
            catchError((error: HttpErrorResponse) => {
              console.error('Errore nel refresh del token', error);
              this.logout();
              return of(null);
            })
          );
      })
    );
  }

  /**
   * Ritorna un token valido, rinnovandolo se necessario.
   */
  getValidAccessToken(): Observable<string | null> {
    return forkJoin([
      from(
        Preferences.get({ key: 'spotifyAccessToken' }) as Promise<{
          value: string | null;
        }>
      ).pipe(map(result => result.value ?? null)),
      from(
        Preferences.get({ key: 'spotifyTokenExpiresAt' }) as Promise<{
          value: string | null;
        }>
      ).pipe(map(result => result.value ?? null)),
    ]).pipe(
      mergeMap(([accessToken, expiresAt]) => {
        if (!accessToken || !expiresAt) {
          return this.refreshAccessToken();
        }
        if (typeof expiresAt === 'string') {
          const expiresAtNum = parseInt(expiresAt, 10);
          const now = Date.now();
          // Se il token è scaduto o sta per scadere entro 30 secondi, rinnovalo
          if (now > expiresAtNum - 30000) {
            return this.refreshAccessToken();
          }
          return of(accessToken);
        } else {
          // Se expiresAt non è una stringa, consideriamo il token non valido e lo rinnoviamo
          return this.refreshAccessToken();
        }
      })
    );
  }

  /**
   * Salva access token, refresh token (se presente) e la scadenza nelle Preferences.
   */
  private async saveTokens(response: any): Promise<void> {
    const accessToken = response.access_token;
    const refreshToken = response.refresh_token; // potrebbe non essere presente in un refresh
    const expiresIn = response.expires_in; // in secondi
    const expiresAt = Date.now() + expiresIn * 1000;

    await Promise.all([
      Preferences.set({ key: 'spotifyAccessToken', value: accessToken }),
      Preferences.set({
        key: 'spotifyTokenExpiresAt',
        value: expiresAt.toString(),
      }),
      refreshToken
        ? Preferences.set({ key: 'spotifyRefreshToken', value: refreshToken })
        : Promise.resolve(),
    ]);
  }

  /**
   * Genera uno stato casuale per il login (utile per CSRF).
   */
  private generateRandomState(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  /**
   * Ritorna gli headers per l'autenticazione con Spotify.
   */
  private getAuthHeaders(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Basic ${btoa(`${this.clientId}:${this.clientSecret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    });
  }

  /**
   * Effettua il logout rimuovendo i token dalle Preferences.
   */
  logout(): void {
    Preferences.remove({ key: 'spotifyAccessToken' });
    Preferences.remove({ key: 'spotifyRefreshToken' });
    Preferences.remove({ key: 'spotifyTokenExpiresAt' });
  }
}
