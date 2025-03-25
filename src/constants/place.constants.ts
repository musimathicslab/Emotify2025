export interface Location {
  value: string;
  label: string;
  image: string;
}

export interface Activity {
  value: string;
  label: string;
  image: string;
  locations: string[];
}

// Definizione delle location disponibili
export const LOCATIONS: Location[] = [
  { value: 'casa', label: 'Casa', image: 'img/activity/home.png' },
  { value: 'ufficio', label: 'Ufficio', image: 'img/activity/workspace.png' },
  { value: 'scuola', label: 'Scuola', image: 'img/activity/school.png' },
  { value: 'palestra', label: 'Palestra', image: 'img/activity/gym.png' },
  { value: 'parco', label: 'Parco', image: 'img/activity/park.png' },
  { value: 'viaggio', label: 'Viaggio', image: 'img/activity/traveling.png' },
];

// Definizione delle attività disponibili
export const ACTIVITIES: Activity[] = [
  {
    value: 'lavorando',
    label: 'Lavorando',
    image: 'img/activity/staff.png',
    locations: ['ufficio', 'casa'],
  },
  {
    value: 'studiando',
    label: 'Studiando',
    image: 'img/activity/teaching.png',
    locations: ['scuola', 'casa'],
  },
  {
    value: 'rilassando',
    label: 'Rilassando',
    image: 'img/activity/beach-sunset.png',
    locations: ['casa', 'parco'],
  },
  {
    value: 'allenandoti',
    label: 'Allenandoti',
    image: 'img/activity/exercise.png',
    locations: ['palestra', 'parco'],
  },
  {
    value: 'leggendo',
    label: 'Leggendo',
    image: 'img/activity/books.png',
    locations: ['casa', 'parco', 'viaggio'],
  },
  {
    value: 'giocando',
    label: 'Giocando',
    image: 'img/activity/gamer.png',
    locations: ['casa'],
  },
  {
    value: 'meditando',
    label: 'Meditando',
    image: 'img/activity/triangle.png',
    locations: ['parco', 'casa'],
  },
  {
    value: 'cucinando',
    label: 'Cucinando',
    image: 'img/activity/cooking.png',
    locations: ['casa'],
  },

  {
    value: 'fotografando',
    label: 'Fotografando',
    image: 'img/photographer.png',
    locations: ['viaggio'],
  },

  {
    value: 'Panorami',
    label: 'Panorami',
    image: 'img/activity/river.png',
    locations: ['viaggio'],
  },
];

// Definizione degli step della selezione
export const STEPS = [
  { label: 'Login Last.fm', stepIndex: 0 },
  { label: 'Login Spotify', stepIndex: 1 },
  { label: 'Luogo', stepIndex: 2 },
  { label: 'Attività', stepIndex: 3 },
  { label: 'Emozioni', stepIndex: 4 },
  { label: 'Grafico', stepIndex: 5 },
  { label: 'Player Spotify', stepIndex: 6 },
];
