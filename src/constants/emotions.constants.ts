export type Severity =
  | 'success'
  | 'info'
  | 'warn'
  | 'danger'
  | 'secondary'
  | 'contrast';

export interface MoodInfo {
  label: string; // Nome in italiano (es. "Triste")
  image: string; // Icona rappresentativa
  severity: Severity; // Colore badge (da utilizzare per i tag)
}

// Definizione globale dei mood con label, immagine e colore
export const MOOD_DATA: Record<number, MoodInfo> = {
  0: {
    label: 'Tristezza',
    image: 'img/sad.png',
    severity: 'success',
  },
  1: {
    label: 'Rabbia',
    image: 'img/angry.png',
    severity: 'danger',
  },
  2: {
    label: 'Felicità',
    image: 'img/happy.png',
    severity: 'danger',
  },
  3: {
    label: 'Paura',
    image: 'img/scare.png',
    severity: 'success',
  },

  4: {
    label: 'Disgusto',
    image: 'img/sick.png',
    severity: 'info',
  },
};

// Definizione delle fasce orarie di ascolto
export const LISTENING_TIME_RANGES: { [key: string]: string } = {
  'Mattina (6-10 AM)': '',
  'Pomeriggio (11 AM - 4 PM)': '',
  'Sera (5-9 PM)': '',
  'Notte (10 PM - 5 AM)': '',
};
