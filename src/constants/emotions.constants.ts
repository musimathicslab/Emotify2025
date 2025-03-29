export type Severity =
  | 'success'
  | 'info'
  | 'warn'
  | 'danger'
  | 'secondary'
  | 'contrast';

export interface MoodInfo {
  label: string; // Nome in italiano (es. "Tristezza")
  image: string; // Icona rappresentativa
  severity: Severity; // Colore badge (da utilizzare per i tag)
}

/**
 * Mappa i 5 mood ai colori (severity) più vicini possibili
 * alle sfumature di emotionsMobile (solo come esempio).
 * Puoi cambiare la severity a tuo piacimento:
 *  - "danger" di solito è rosso
 *  - "warn" di solito è giallo/arancio
 *  - "success" di solito è verde
 *  - "info" di solito è blu
 *  - "secondary" spesso è grigio o viola
 *  - "contrast" potrebbe essere nero/bianco (dipende dal tema)
 */
export const MOOD_DATA: Record<number, MoodInfo> = {
  0: {
    label: 'Tristezza', // colore in emotionsMobile: blu
    image: 'img/sad.png',
    severity: 'info', // "info" è spesso blu/azzurro
  },
  1: {
    label: 'Rabbia', // colore in emotionsMobile: arancione/rosso
    image: 'img/angry.png',
    severity: 'danger', // "danger" è tipicamente rosso
  },
  2: {
    label: 'Felicità', // colore in emotionsMobile: giallo
    image: 'img/happy.png',
    severity: 'warn', // "warn" è giallo/arancione
  },
  3: {
    label: 'Paura', // colore in emotionsMobile: viola
    image: 'img/scare.png',
    severity: 'secondary', // "secondary" spesso è grigio o viola chiaro
  },
  4: {
    label: 'Disgusto', // colore in emotionsMobile: verde
    image: 'img/sick.png',
    severity: 'success', // "success" è solitamente verde
  },
};
