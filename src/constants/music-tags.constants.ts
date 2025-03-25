// Questi oggetti definiscono i tag per ciascuna feature
export const MUSIC_TAGS = {
  TEMPO: {
    LOW: 'slow',
    MEDIUM: 'moderate',
    HIGH: 'upbeat',
  },
  DANCEABILITY: {
    LOW: 'chill',
    MEDIUM: 'groovy',
    HIGH: 'danceable',
  },
  INSTRUMENTALNESS: {
    LOW: 'vocal',
    HIGH: 'instrumental',
  },
  SPEECHINESS: {
    LOW: 'melodic',
    HIGH: 'spoken',
  },
  LOUDNESS: {
    LOW: 'soft',
    HIGH: 'loud',
  },
};

// Qui definiamo le soglie per ciascuna feature, adattate a valori da 0 a 100
export const FEATURE_THRESHOLDS = {
  TEMPO: { low: 0, medium: 33, high: 66 },
  DANCEABILITY: { low: 0, medium: 33, high: 66 },
  INSTRUMENTALNESS: { low: 0, high: 50 },
  SPEECHINESS: { low: 0, high: 50 },
  LOUDNESS: { low: 0, high: 50 },
};

export const VOCAB_TEMPO = Object.values(MUSIC_TAGS.TEMPO); // ['slow', 'moderate', 'upbeat']
export const VOCAB_DANCE = Object.values(MUSIC_TAGS.DANCEABILITY); // ['chill', 'groovy', 'danceable']
export const VOCAB_INSTR = Object.values(MUSIC_TAGS.INSTRUMENTALNESS); // ['vocal', 'instrumental']
export const VOCAB_SPEECH = Object.values(MUSIC_TAGS.SPEECHINESS); // ['melodic', 'spoken']
export const VOCAB_LOUD = Object.values(MUSIC_TAGS.LOUDNESS); // ['soft', 'loud']
