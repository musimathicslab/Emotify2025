import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { from, Observable, of, throwError } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { SpotifyLoginService } from './spotify.service';
import { Preferences } from '@capacitor/preferences';

interface SpotifyArtist {
  name: string;
  images: { url: string }[];
}

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
        const items = response?.artists?.items as SpotifyArtist[];
        if (items && items.length > 0) {
          // Cerca il primo artista con immagini e nome simile
          const found = items.find(
            (item: SpotifyArtist) =>
              this.isNameSimilar(artistName, item.name) &&
              item.images &&
              item.images.length > 0
          );
          if (found) {
            // Restituisce l'immagine più grande (in genere la prima)
            return found.images[0].url;
          }
        }
        // Se nessun risultato soddisfa le condizioni, restituisce l'immagine di fallback
        return 'img/musician-2.png';
      }),
      catchError(error => {
        console.error('Errore in getArtistImage per', artistName, error);
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
          .set('limit', '5');

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
                  .set('limit', '5');
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
    const normalizedSearched = searchedName.toLowerCase().trim();
    const normalizedResult = resultName.toLowerCase().trim();
    const match =
      normalizedResult.includes(normalizedSearched) ||
      normalizedSearched.includes(normalizedResult);
    return match;
  }
}
