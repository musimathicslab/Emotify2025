import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { from, Observable, of, throwError } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { SpotifyLoginService } from './spotify.service';
import { Preferences } from '@capacitor/preferences';

@Injectable({
  providedIn: 'root',
})
export class SpotifyArtistService {
  private apiUrl = 'https://api.spotify.com/v1';

  constructor(
    private http: HttpClient,
    private loginService: SpotifyLoginService
  ) {}

  /**
   * Cerca l'artista per nome e restituisce l'URL dell'immagine.
   * Se il nome restituito non corrisponde a quello cercato o se mancano le immagini,
   * viene restituita un'immagine di fallback.
   */
  getArtistImage(artistName: string): Observable<string> {
    return this.makeSearchRequest(artistName).pipe(
      map(response => {
        const items = response?.artists?.items;
        // Controlla se esiste almeno un artista, se il nome è simile e se sono presenti immagini
        if (
          items &&
          items.length > 0 &&
          this.isNameSimilar(artistName, items[0].name) &&
          items[0].images &&
          items[0].images.length > 0
        ) {
          // Restituisci l'immagine più grande (di solito la prima)
          return items[0].images[0].url;
        }
        // Se uno di questi controlli fallisce, restituisci l'immagine di fallback
        return 'img/musician-2.png ';
      }),
      catchError(error => {
        console.error('Errore in getArtistImage per', artistName, error);
        // In caso di errori, restituisci l'immagine di fallback
        return of('img/musician-2.png');
      })
    );
  }

  /**
   * Esegue la richiesta di ricerca dell'artista.
   * Se il token è scaduto, tenta di rinnovarlo e ripete la richiesta.
   */
  private makeSearchRequest(artistName: string): Observable<any> {
    return from(Preferences.get({ key: 'spotifyAccessToken' })).pipe(
      switchMap(result => {
        const accessToken = result.value;
        if (!accessToken) {
          console.error('Spotify access token mancante');
          return throwError('Token mancante');
        }
        const headers = new HttpHeaders({
          Authorization: `Bearer ${accessToken}`,
        });
        const params = new HttpParams()
          .set('q', artistName)
          .set('type', 'artist')
          .set('limit', '1');

        return this.http.get<any>(`${this.apiUrl}/search`, { headers, params });
      }),
      catchError(error => {
        if (error.status === 401) {
          console.warn('Token scaduto. Provo a rinnovarlo...');
          return this.loginService.refreshAccessToken().pipe(
            switchMap(newToken => {
              if (newToken) {
                // Salva il nuovo token nelle Preferences
                Preferences.set({ key: 'spotifyAccessToken', value: newToken });
                const newHeaders = new HttpHeaders({
                  Authorization: `Bearer ${newToken}`,
                });
                const params = new HttpParams()
                  .set('q', artistName)
                  .set('type', 'artist')
                  .set('limit', '1');
                // Ripeti la richiesta con il nuovo token
                return this.http.get<any>(`${this.apiUrl}/search`, {
                  headers: newHeaders,
                  params,
                });
              }
              return throwError('Impossibile rinnovare il token');
            })
          );
        }
        return throwError(error);
      })
    );
  }

  /**
   * Confronta il nome cercato con quello ottenuto dalla ricerca.
   * Puoi espandere questa logica per usare algoritmi di similarità più sofisticati.
   */
  private isNameSimilar(searchedName: string, resultName: string): boolean {
    return (
      searchedName.toLowerCase().trim() === resultName.toLowerCase().trim()
    );
  }
}
