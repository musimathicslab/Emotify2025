import { Injectable } from '@angular/core';
import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
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
} from 'rxjs';
import md5 from 'crypto-js/md5';
import { Preferences } from '@capacitor/preferences';

@Injectable({
  providedIn: 'root',
})
export class LastFmService {
  private apiUrl = 'https://ws.audioscrobbler.com/2.0/';
  private apiKey = environment.lastFm.apiKey;
  private apiSecret = environment.lastFm.apiSecret;
  private redirectUri = environment.lastFm.callbackUrl;
  private authUrl = 'https://www.last.fm/api/auth/';

  constructor(private http: HttpClient) {}

  performLastFmLogin(): void {
    window.location.href = `${this.authUrl}?api_key=${this.apiKey}&cb=${encodeURIComponent(this.redirectUri)}`;
  }

  async handleCallback(): Promise<string | null> {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token) {
      await Preferences.set({ key: 'lastfmToken', value: token });
    } else {
      console.warn('⚠️ Nessun token trovato nel callback URL.');
    }
    return token;
  }

  isAuthenticated(): Observable<boolean> {
    return from(Preferences.get({ key: 'lastfmToken' })).pipe(
      map(result => !!result.value)
    );
  }

  /**
   * Helper privato per ottenere lo username corrente dal Preferences.
   */
  private getCurrentUsername(): Observable<string> {
    return from(Preferences.get({ key: 'lastfmUser' })).pipe(
      mergeMap(result => {
        if (result.value) {
          return of(result.value);
        } else {
          return this.getAuthenticatedUser().pipe(
            mergeMap(user => of(user || ''))
          );
        }
      })
    );
  }

  /**
   * Recupera il profilo utente di Last.fm.
   */
  getUserProfile(username?: string): Observable<any> {
    if (username) {
      const url = `${this.apiUrl}?method=user.getinfo&user=${username}&api_key=${this.apiKey}&format=json`;
      return this.http.get(url);
    } else {
      return this.getCurrentUsername().pipe(
        mergeMap(user => {
          if (!user) {
            console.warn('⚠️ Nessun username disponibile.');
            return of(null);
          }
          const url = `${this.apiUrl}?method=user.getinfo&user=${user}&api_key=${this.apiKey}&format=json`;
          return this.http.get(url);
        })
      );
    }
  }

  /**
   * Ottiene i brani recenti ascoltati dall'utente.
   */
  getRecentTracks(username?: string, limit: number = 10): Observable<any> {
    const buildUrl = (user: string) =>
      `${this.apiUrl}?method=user.getrecenttracks&user=${user}&api_key=${this.apiKey}&format=json&limit=${limit}`;
    if (username) {
      return this.http.get<any>(buildUrl(username)).pipe(
        map(data => data?.recenttracks?.track || []),
        catchError(error => {
          console.error('❌ Errore API Last.fm getRecentTracks:', error);
          return of([]);
        })
      );
    } else {
      return this.getCurrentUsername().pipe(
        mergeMap(user => {
          if (!user) {
            console.warn('⚠️ Nessun username disponibile.');
            return of([]);
          }
          return this.http.get<any>(buildUrl(user)).pipe(
            map(data => data?.recenttracks?.track || []),
            catchError(error => {
              console.error('❌ Errore API Last.fm getRecentTracks:', error);
              return of([]);
            })
          );
        })
      );
    }
  }

  /**
   * Ottiene gli artisti più ascoltati dall'utente.
   */
  getTopArtists(username?: string, limit: number = 5): Observable<any[]> {
    const buildUrl = (user: string) =>
      `${this.apiUrl}?method=user.gettopartists&user=${user}&api_key=${this.apiKey}&format=json&limit=${limit}`;
    if (username) {
      return this.http
        .get<{ topartists: { artist: any[] } }>(buildUrl(username))
        .pipe(
          map(response => {
            return (
              response?.topartists?.artist.map(artist => {
                const images = artist.image || [];
                let validImage = images.find(
                  (img: any) =>
                    img.size === 'extralarge' &&
                    img['#text'] &&
                    !img['#text'].includes('2a96cbd8b46e442fc41c2b86b821562f')
                )?.['#text'];
                if (!validImage) {
                  validImage = images.find(
                    (img: any) =>
                      img.size === 'large' &&
                      img['#text'] &&
                      !img['#text'].includes('2a96cbd8b46e442fc41c2b86b821562f')
                  )?.['#text'];
                }
                validImage =
                  validImage ||
                  images.find((img: any) => img['#text'])?.['#text'] ||
                  'img/musician-2.png';
                return {
                  name: artist.name,
                  image: validImage,
                  url: artist.url,
                  playcount: artist.playcount,
                };
              }) || []
            );
          }),
          catchError(error => {
            console.error(
              '❌ Errore nel recupero degli artisti più ascoltati:',
              error
            );
            return of([]);
          })
        );
    } else {
      return this.getCurrentUsername().pipe(
        mergeMap(user => {
          if (!user) {
            console.warn('⚠️ Nessun username disponibile.');
            return of([]);
          }
          return this.http
            .get<{ topartists: { artist: any[] } }>(buildUrl(user))
            .pipe(
              map(response => {
                return (
                  response?.topartists?.artist.map(artist => {
                    const images = artist.image || [];
                    let validImage = images.find(
                      (img: any) =>
                        img.size === 'extralarge' &&
                        img['#text'] &&
                        !img['#text'].includes(
                          '2a96cbd8b46e442fc41c2b86b821562f'
                        )
                    )?.['#text'];
                    if (!validImage) {
                      validImage = images.find(
                        (img: any) =>
                          img.size === 'large' &&
                          img['#text'] &&
                          !img['#text'].includes(
                            '2a96cbd8b46e442fc41c2b86b821562f'
                          )
                      )?.['#text'];
                    }
                    validImage =
                      validImage ||
                      images.find((img: any) => img['#text'])?.['#text'] ||
                      'img/musician-2.png';
                    return {
                      name: artist.name,
                      image: validImage,
                      url: artist.url,
                      playcount: artist.playcount,
                    };
                  }) || []
                );
              }),
              catchError(error => {
                console.error(
                  '❌ Errore nel recupero degli artisti più ascoltati:',
                  error
                );
                return of([]);
              })
            );
        })
      );
    }
  }

  /**
   * Recupera i tag principali associati a una traccia specifica.
   */
  getTrackTopTags(trackTitle: string, artist: string): Observable<string[]> {
    const url = `${this.apiUrl}?method=track.gettoptags&track=${encodeURIComponent(
      trackTitle
    )}&artist=${encodeURIComponent(artist)}&api_key=${this.apiKey}&format=json`;
    return this.http.get<any>(url).pipe(
      map(response => {
        if (response.toptags && response.toptags.tag) {
          return response.toptags.tag.map((t: any) => t.name);
        }
        return [];
      }),
      catchError(error => {
        console.error(
          `❌ Errore nel recupero dei tag per "${trackTitle}" - "${artist}":`,
          error
        );
        return of([]);
      })
    );
  }

  /**
   * Ottiene i generi principali in base agli artisti più ascoltati.
   */
  getTopGenres(username?: string, limit: number = 10): Observable<string[]> {
    const buildUrl = (user: string) =>
      `${this.apiUrl}?method=user.gettopartists&user=${user}&api_key=${this.apiKey}&format=json&limit=${limit}`;
    if (username) {
      return this.http.get<any>(buildUrl(username)).pipe(
        map(response => {
          return response?.topartists?.artist || [];
        }),
        mergeMap(artists => {
          if (!artists.length) {
            console.warn('No artists found.');
            return of([]);
          }
          const tagRequests: Observable<string[]>[] = artists.map(
            (artist: { name: string }) => {
              return this.getArtistTags(artist.name);
            }
          );
          return forkJoin(tagRequests).pipe(
            map((tagResults: string[][]) => {
              const genreCount: { [key: string]: number } = {};
              tagResults.forEach(tags => {
                tags.forEach(tag => {
                  const genre = tag.toLowerCase();
                  genreCount[genre] = (genreCount[genre] || 0) + 1;
                });
              });
              return Object.entries(genreCount)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(entry => entry[0]);
            })
          );
        }),
        catchError(error => {
          console.error('❌ Errore nel recupero dei generi:', error);
          return of([]);
        })
      );
    } else {
      return this.getCurrentUsername().pipe(
        mergeMap(user => {
          if (!user) {
            console.warn('⚠️ Nessun username disponibile.');
            return of([]);
          }
          return this.http.get<any>(buildUrl(user)).pipe(
            map(response => response?.topartists?.artist || []),
            mergeMap(artists => {
              if (!artists.length) return of([]);
              const tagRequests: Observable<string[]>[] = artists.map(
                (artist: { name: string }) => this.getArtistTags(artist.name)
              );
              return forkJoin(tagRequests).pipe(
                map((tagResults: string[][]) => {
                  const genreCount: { [key: string]: number } = {};
                  tagResults.forEach(tags => {
                    tags.forEach(tag => {
                      const genre = tag.toLowerCase();
                      genreCount[genre] = (genreCount[genre] || 0) + 1;
                    });
                  });
                  return Object.entries(genreCount)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10)
                    .map(entry => entry[0]);
                })
              );
            }),
            catchError(error => {
              console.error('❌ Errore nel recupero dei generi:', error);
              return of([]);
            })
          );
        })
      );
    }
  }

  /**
   * Recupera i tag principali di un artista.
   */
  getArtistTags(artist: string): Observable<string[]> {
    const url = `${this.apiUrl}?method=artist.gettoptags&artist=${encodeURIComponent(artist)}&api_key=${this.apiKey}&format=json`;
    return this.http.get<any>(url).pipe(
      map(response => {
        if (response?.toptags?.tag) {
          return response.toptags.tag.map((t: any) => t.name);
        }
        return [];
      }),
      catchError(error => {
        console.error(`❌ Errore nel recupero dei tag per "${artist}":`, error);
        return of([]);
      })
    );
  }

  /**
   * Genera la firma API necessaria per le richieste protette.
   */
  private generateApiSig(params: { [key: string]: string }): string {
    const sortedKeys = Object.keys(params).sort();
    let rawSig = '';
    sortedKeys.forEach(key => {
      rawSig += key + params[key];
    });
    rawSig += this.apiSecret;
    return md5(rawSig).toString();
  }

  /**
   * Ottiene l'utente autenticato su Last.fm utilizzando il token salvato con Capacitor Preferences.
   * Restituisce un Observable<string | null>.
   */
  getAuthenticatedUser(): Observable<string | null> {
    return from(Preferences.get({ key: 'lastfmToken' })).pipe(
      mergeMap(tokenResult => {
        const token = tokenResult.value ?? null;
        if (!token) {
          console.warn('⚠️ Nessun token trovato.');
          return of(null);
        }
        const params = {
          api_key: this.apiKey,
          method: 'auth.getSession',
          token: token,
        };
        const apiSig = this.generateApiSig(params);
        const requestUrl = `${this.apiUrl}?method=auth.getSession&api_key=${this.apiKey}&token=${token}&api_sig=${apiSig}&format=json`;
        return this.http.get<any>(requestUrl).pipe(
          mergeMap(data => {
            if (data?.session?.name) {
              return from(
                Promise.all([
                  Preferences.set({
                    key: 'lastfmSessionKey',
                    value: data.session.key,
                  }),
                  Preferences.set({
                    key: 'lastfmUser',
                    value: data.session.name,
                  }),
                ])
              ).pipe(map(() => data.session.name));
            } else {
              return of(null);
            }
          }),
          catchError((error: HttpErrorResponse) => {
            console.error('❌ Errore API Last.fm getAuthenticatedUser:', error);
            return of(null);
          })
        );
      }),
      map(result => result ?? null)
    );
  }

  /**
   * Recupera le tracce migliori dell'utente.
   */
  getTopTracks(username?: string, limit: number = 10): Observable<any[]> {
    if (username) {
      return this.fetchTopTracks(username, limit);
    } else {
      return this.getCurrentUsername().pipe(
        mergeMap(user => {
          if (!user) {
            console.warn('⚠️ Nessun username disponibile.');
            return of([]);
          }
          return this.fetchTopTracks(user, limit);
        })
      );
    }
  }

  /**
   * Esegue la chiamata API per recuperare le top tracks dato lo username.
   */
  private fetchTopTracks(
    username: string,
    limit: number = 10
  ): Observable<any[]> {
    const url = `${this.apiUrl}?method=user.gettoptracks&user=${username}&api_key=${this.apiKey}&format=json&limit=${limit}`;
    return this.http.get<any>(url).pipe(
      map(response => response?.toptracks?.track || []),
      mergeMap(tracks => {
        if (!tracks.length) return of([]);
        const trackRequests: Observable<any>[] = tracks.map(
          (track: { name: string; artist: { name: string } }) =>
            this.getTrackInfo(track.name, track.artist.name)
        );
        return forkJoin(trackRequests);
      }),
      catchError(error => {
        console.error(
          '❌ Errore nel recupero dei brani più riprodotti:',
          error
        );
        return of([]);
      })
    );
  }

  /**
   * Recupera i dettagli di una traccia, inclusa la copertina dell'album.
   */
  getTrackInfo(track: string, artist: string): Observable<any> {
    const url = `${this.apiUrl}?method=track.getInfo&track=${encodeURIComponent(
      track
    )}&artist=${encodeURIComponent(artist)}&api_key=${this.apiKey}&format=json`;
    return this.http.get<any>(url).pipe(
      map(response => {
        const albumImages = response.track?.album?.image || [];
        const albumImage =
          albumImages.find((img: any) => img.size === 'large')?.['#text'] ||
          albumImages.find((img: any) => img.size === 'extralarge')?.[
            '#text'
          ] ||
          '';
        const artistImages = response.track?.artist?.image || [];
        const artistImage =
          artistImages.find((img: any) => img.size === 'large')?.['#text'] ||
          artistImages.find((img: any) => img.size === 'extralarge')?.[
            '#text'
          ] ||
          '';
        return {
          name: response.track?.name || track,
          artist: response.track?.artist?.name || artist,
          image: albumImage || artistImage || 'img/music.png',
        };
      }),
      catchError(error => {
        console.error(
          `❌ Errore nel recupero delle info per "${track}" - "${artist}":`,
          error
        );
        return of({
          name: track,
          artist: artist,
          image: 'assets/default-track.png',
        });
      })
    );
  }

  /**
   * Recupera le tracce più popolari per il tag indicato.
   */
  getTopTracksByTag(
    tag: string,
    limit?: number,
    page?: number
  ): Observable<any[]> {
    let url = `${this.apiUrl}?method=tag.gettoptracks&tag=${encodeURIComponent(tag)}&api_key=${this.apiKey}&format=json`;
    if (limit) {
      url += `&limit=${limit}`;
    }
    if (page) {
      url += `&page=${page}`;
    }
    return this.http.get<any>(url).pipe(
      map(
        response => response?.tracks?.track || response?.toptracks?.track || []
      ),
      catchError(error => {
        console.error(
          `❌ Errore nel recupero delle tracce per il tag "${tag}":`,
          error
        );
        return of([]);
      })
    );
  }

  /**
   * Effettua il login mobile utilizzando il metodo auth.getMobileSession.
   * Invia username e password via POST e salva i dati della sessione tramite Preferences.
   */
  mobileLogin(username: string, password: string): Observable<any> {
    const method = 'auth.getMobileSession';
    const paramsObj: { [key: string]: string } = {
      api_key: this.apiKey,
      method,
      password,
      username,
    };

    // Ordina le chiavi e costruisci la stringa per la firma
    const sortedKeys = Object.keys(paramsObj).sort();
    let signatureBase = '';
    sortedKeys.forEach(key => {
      signatureBase += key + paramsObj[key];
    });
    signatureBase += this.apiSecret;
    const apiSig = md5(signatureBase).toString();
    const body = new URLSearchParams();
    body.set('api_key', this.apiKey);
    body.set('method', method);
    body.set('username', username);
    body.set('password', password);
    body.set('api_sig', apiSig);
    body.set('format', 'json');
    const headers = new HttpHeaders({
      'Content-Type': 'application/x-www-form-urlencoded',
    });
    return this.http.post<any>(this.apiUrl, body.toString(), { headers }).pipe(
      mergeMap(async response => {
        if (response && response.session) {
          await Preferences.set({
            key: 'lastfmUser',
            value: response.session.name,
          });
          await Preferences.set({
            key: 'lastfmSessionKey',
            value: response.session.key,
          });
          if (response.token) {
            await Preferences.set({
              key: 'lastfmToken',
              value: response.token,
            });
          }
        } else {
          console.error('Sessione non ottenuta dalla risposta:', response);
        }
        return response;
      }),
      mergeMap(result => of(result)),
      catchError((error: HttpErrorResponse) => {
        console.error('Errore in mobileLogin:', JSON.stringify(error));
        return of(null);
      })
    );
  }

  addTagsToTrack(
    artist: string,
    track: string,
    tags: string[],
    sessionKey: string
  ): Observable<any> {
    const method = 'track.addTags';

    // Prepara i parametri richiesti
    const params: { [key: string]: string } = {
      method,
      artist,
      track,
      tag: tags.join(','), // i tag vengono uniti con la virgola
      api_key: this.apiKey,
      sk: sessionKey,
      format: 'json',
    };

    // Genera la firma escludendo il parametro "format"
    const sortedKeys = Object.keys(params)
      .filter(key => key !== 'format')
      .sort();
    let signature = '';
    sortedKeys.forEach(key => {
      signature += key + params[key];
    });
    signature += this.apiSecret;
    params['api_sig'] = md5(signature).toString();

    // Costruisci il corpo della richiesta in formato URL-encoded
    const body = Object.entries(params)
      .map(
        ([key, value]) =>
          `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
      )
      .join('&');

    const headers = new HttpHeaders({
      'Content-Type': 'application/x-www-form-urlencoded',
    });

    return this.http.post(this.apiUrl, body, { headers }).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error("❌ Errore nell'aggiornamento dei tag:", error);
        return of(null);
      })
    );
  }
}
