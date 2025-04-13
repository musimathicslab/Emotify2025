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
    apiKey: '45854012fdd30c142c58da81d70d2dcc',
    apiSecret: '8e4feca7174245366c1df09276806e1e',
    callbackUrl: 'https://musimathicslab.github.io/Emotify2025/callback-lastfm',
  },
};
