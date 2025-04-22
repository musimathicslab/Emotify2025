import { Injectable } from '@angular/core';
import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
  HttpParams,
} from '@angular/common/http';
import { environment } from '../environments/environment'; // Assicurati che il path sia corretto
import {
  catchError,
  forkJoin,
  from,
  map,
  mergeMap,
  Observable,
  of,
  tap, // Importa 'tap' per i log senza modificare il flusso
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
    ? 'myapp://spotify-callback' // Assicurati che sia configurato correttamente nel manifest/info.plist
    : environment.spotify.redirectUri;

  private authEndpoint = 'https://accounts.spotify.com/authorize';
  private tokenEndpoint = 'https://accounts.spotify.com/api/token';
  private scope =
    'ugc-image-upload user-read-email user-read-private user-read-recently-played user-top-read user-read-playback-position user-read-playback-state user-modify-playback-state user-read-currently-playing app-remote-control streaming playlist-read-private playlist-read-collaborative playlist-modify-public playlist-modify-private user-follow-read user-follow-modify user-library-read user-library-modify';

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
      .set('state', this.generateRandomState()) // Salva questo stato se devi verificarlo al ritorno
      .set('show_dialog', 'true'); // Forza il dialogo di login/autorizzazione

    return `${this.authEndpoint}?${params.toString()}`;
  }

  /**
   * Scambia il codice ricevuto per un access token e refresh token.
   */
  exchangeCodeForToken(code: string): Observable<any> {
    console.log(`Tentativo scambio codice: ${code.substring(0, 10)}...`);
    const body = new HttpParams()
      .set('grant_type', 'authorization_code')
      .set('code', code)
      .set('redirect_uri', this.redirectUri); // Deve corrispondere esattamente

    const headers = this.getAuthHeaders();

    return this.http
      .post<any>(this.tokenEndpoint, body.toString(), { headers })
      .pipe(
        timeout(60000), // Timeout di 60 secondi
        tap(response => console.log('Risposta scambio codice:', response)), // Log risposta grezza
        mergeMap(response => {
          if (!response || !response.access_token) {
            console.error('Scambio codice fallito: risposta token non valida.', response);
            throw new Error('Risposta token non valida dallo scambio codice'); // Lancia errore per il catchError
          }
          // Salva i token PRIMA di emettere la risposta
          return from(this.saveTokens(response)).pipe(map(() => response)); // Ritorna la risposta completa dopo salvataggio
        }),
        catchError(error => {
          console.error('Errore nello scambio del codice per il token:', error);
          // Non ritornare 'of(null)' qui, lascia che l'errore si propaghi o gestiscilo meglio
          // return of(null);
          throw error; // Rilancia l'errore per chi chiama questo metodo
        })
      );
  }

  /**
   * Prova a rinnovare l'access token usando il refresh token salvato.
   */
  refreshAccessToken(): Observable<string | null> {
    return from(Preferences.get({ key: 'spotifyRefreshToken' })).pipe(
      // Logga il token recuperato da Preferences
      tap(refreshTokenResult => console.log("Tentativo refresh: Recuperato refresh token da Preferences:", refreshTokenResult.value ? 'Presente' : 'ASSENTE')),
      mergeMap(refreshTokenResult => {
        const refreshToken = refreshTokenResult.value;
        if (!refreshToken) {
          console.error('Nessun refresh token disponibile in Preferences per il refresh.');
          // Se non c'è refresh token, non possiamo fare nulla, consideralo come un logout
          this.logout(); // Pulisce gli altri token potenzialmente presenti
          return of(null); // Ritorna null per indicare fallimento/logout
        }

        console.log(`Tentativo refresh con token: ${refreshToken.substring(0, 10)}...`);
        const body = new HttpParams()
          .set('grant_type', 'refresh_token')
          .set('refresh_token', refreshToken);

        const headers = this.getAuthHeaders();

        return this.http
          .post<any>(this.tokenEndpoint, body.toString(), { headers })
          .pipe(
            tap(response => console.log('Risposta refresh token:', response)), // Log risposta grezza refresh
            mergeMap(response => {
              if (!response || !response.access_token) {
                console.error('Refresh token fallito: risposta token non valida.', response);
                throw new Error('Risposta token non valida dal refresh');
              }
              // Salva i nuovi token (incluso il potenziale nuovo refresh token)
              return from(this.saveTokens(response)).pipe(
                // Dopo aver salvato, emetti il NUOVO access token
                map(() => response.access_token)
              );
            }),
            catchError((error: HttpErrorResponse) => {
              console.error('Errore HTTP durante il refresh del token:', error);
              // Se l'errore è 'invalid_grant', il refresh token non è valido (scaduto, revocato, ecc.)
              if (error.status === 400 && error.error?.error === 'invalid_grant') {
                console.warn('Refresh token non valido (invalid_grant). Eseguo logout.');
              } else {
                // Altri errori (rete, server Spotify, ecc.)
                console.error('Errore imprevisto durante il refresh:', error.message);
              }
              // In ogni caso di errore nel refresh, esegui il logout e ritorna null
              this.logout();
              return of(null);
            })
          );
      })
    );
  }

  /**
   * Ritorna un token valido, rinnovandolo se necessario.
   * Questa è la funzione principale da chiamare per ottenere un token.
   */
  getValidAccessToken(): Observable<string | null> {
    return forkJoin({ // Usa oggetto per chiarezza
      accessToken: from(Preferences.get({ key: 'spotifyAccessToken' })).pipe(map(r => r.value)),
      expiresAtStr: from(Preferences.get({ key: 'spotifyTokenExpiresAt' })).pipe(map(r => r.value))
    }).pipe(
      mergeMap(({ accessToken, expiresAtStr }) => {
        // Log valori recuperati
        // console.log(`getValidAccessToken: accessToken: ${accessToken ? 'Presente' : 'No'}, expiresAtStr: ${expiresAtStr}`);

        if (!accessToken || !expiresAtStr) {
          // Se manca uno dei due, prova a fare refresh (che gestirà il caso di assenza di refresh token)
          console.log('Token o scadenza mancanti, tento refresh...');
          return this.refreshAccessToken();
        }

        // Converti expiresAt in numero
        const expiresAt = Number(expiresAtStr); // Usa Number() che gestisce stringhe e ritorna NaN se non valido
        if (isNaN(expiresAt)) {
          // Scadenza non valida, forza refresh
          console.warn('Scadenza token non valida (NaN), forzo refresh...');
          return this.refreshAccessToken();
        }

        const now = Date.now();
        const bufferSeconds = 60; // Aumenta il buffer a 60 secondi per sicurezza
        const threshold = expiresAt - (bufferSeconds * 1000);

        // Log controllo scadenza
        // console.log(`Check scadenza: Now=${now}, ExpiresAt=${expiresAt}, Threshold=${threshold}`);

        if (now >= threshold) {
          // Token scaduto o in scadenza, fai refresh
          console.log('Token scaduto o in scadenza, tento refresh...');
          return this.refreshAccessToken();
        } else {
          // Token valido, ritorna quello esistente
          // console.log('Token valido trovato in cache.');
          return of(accessToken);
        }
      }),
      catchError(error => {
        // Gestisce errori imprevisti nel recupero da Preferences o nella logica interna
        console.error("Errore imprevisto in getValidAccessToken:", error);
        return of(null); // Ritorna null in caso di errori interni
      })
    );
  }

  /**
   * Salva access token, refresh token (se presente) e la scadenza nelle Preferences.
   * Questa funzione è cruciale.
   */
  private async saveTokens(response: any): Promise<void> {
    const accessToken = response.access_token;
    // IMPORTANTE: Leggi il refresh token dalla risposta. Potrebbe essere null se non restituito (es. durante refresh)
    const newRefreshToken = response.refresh_token;
    const expiresIn = response.expires_in; // in secondi

    if (!accessToken || !expiresIn) {
      console.error("saveTokens: Dati insufficienti nella risposta per salvare.", response);
      return; // Non salvare nulla se mancano dati essenziali
    }

    const expiresAt = Date.now() + (Number(expiresIn) * 1000);

    // Log cosa stiamo per salvare
    console.log(`Salvataggio token: AccessToken=${accessToken.substring(0,5)}..., RefreshToken=${newRefreshToken ? 'Presente' : 'Non presente nella risposta'}, ExpiresAt=${new Date(expiresAt).toISOString()}`);

    const promises: Promise<any>[] = [
      Preferences.set({ key: 'spotifyAccessToken', value: accessToken }),
      Preferences.set({ key: 'spotifyTokenExpiresAt', value: expiresAt.toString() }),
    ];

    // Salva il NUOVO refresh token SOLO SE è stato fornito nella risposta
    if (newRefreshToken) {
      console.log(" -> Salvando NUOVO refresh token ricevuto.");
      promises.push(Preferences.set({ key: 'spotifyRefreshToken', value: newRefreshToken }));
    } else {
      console.log(" -> Nessun NUOVO refresh token nella risposta, quello vecchio (se esiste) rimane invariato.");
      // Non fare nulla con spotifyRefreshToken se non ne arriva uno nuovo
    }

    try {
      await Promise.all(promises);
      console.log("Salvataggio token completato.");
      // Log di verifica opzionale
      // const checkAccess = await Preferences.get({ key: 'spotifyAccessToken' });
      // const checkRefresh = await Preferences.get({ key: 'spotifyRefreshToken' });
      // console.log(`Verifica post-salvataggio: Access=${checkAccess.value ? 'OK' : 'FAIL'}, Refresh=${checkRefresh.value ? 'OK' : 'FAIL/UNCHANGED'}`);
    } catch (error) {
      console.error("Errore durante il salvataggio dei token in Preferences:", error);
      // Considera se propagare l'errore o gestirlo qui
    }
  }

  /**
   * Genera uno stato casuale per il login (utile per CSRF).
   */
  private generateRandomState(): string {
    // Implementazione semplice, potresti volerla rendere più robusta crittograficamente
    return Math.random().toString(36).substring(2, 15);
  }

  /**
   * Ritorna gli headers per l'autenticazione con Spotify (richieste /api/token).
   */
  private getAuthHeaders(): HttpHeaders {
    // Assicurati che clientId e clientSecret siano definiti e validi
    if (!this.clientId || !this.clientSecret) {
      console.error("Client ID o Client Secret non configurati correttamente!");
      // Potresti voler lanciare un errore qui
    }
    const credentials = btoa(`${this.clientId}:${this.clientSecret}`);
    return new HttpHeaders({
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    });
  }

  /**
   * Effettua il logout rimuovendo i token dalle Preferences.
   * Chiamata sicura anche se i token non esistono.
   */
  async logout(): Promise<void> {
    console.log("Logout: Rimozione token da Preferences...");
    try {
      await Promise.all([
        Preferences.remove({ key: 'spotifyAccessToken' }),
        Preferences.remove({ key: 'spotifyRefreshToken' }),
        Preferences.remove({ key: 'spotifyTokenExpiresAt' }),
      ]);
      console.log("Token rimossi con successo.");
    } catch(error) {
      console.error("Errore durante la rimozione dei token al logout:", error);
    }
  }
}
