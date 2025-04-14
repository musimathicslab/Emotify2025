export const environment = {
  production: false,
  spotify: {
    accountApiUrl: 'https://accounts.spotify.com',
    apiUrl: 'https://api.spotify.com/v1',
    clientId: 'baa948d432a14c978668ca7cc53a4b2d',
    clientSecret: 'f91194effc8b4bd09aef00ff3224e67d',
    redirectUri: 'http://localhost:4200/callback',
    scope:
      'user-read-private user-read-email playlist-read-private user-library-modify user-top-read user-read-playback-state user-modify-playback-state user-read-currently-playing streaming user-read-recently-played user-library-read user-follow-read',
    customPlayerName: 'Emotify2025',
  },
  lastFm: {
    apiUrl: 'https://ws.audioscrobbler.com/2.0/',
    apiKey: '6f3aba054ea20ed1ef80d41ce22e870d',
    apiSecret: '2be8e6dd9b9a05c97b3c8b0e4ce32071',
    callbackUrl: 'http://localhost:4200/callback-lastfm',
  },
};
