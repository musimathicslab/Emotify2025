/**
 * Mappa un valore (0-100) al relativo tag usando le soglie specificate.
 *
 * Se è definita una soglia media e il corrispondente tag MEDIUM,
 * il valore viene mappato a LOW se <= threshold.medium, a MEDIUM se compreso tra threshold.medium e threshold.high,
 * e a HIGH se >= threshold.high.
 *
 * Per feature che hanno solo due fasce, verrà usato LOW se il valore è inferiore a threshold.high,
 * altrimenti HIGH.
 */
/**
 * Restituisce il tag in base al valore, alle soglie e al mapping.
 */
export function getTagForFeature(
  value: number,
  thresholds: { low: number; medium?: number; high: number },
  mapping: { LOW: string; MEDIUM?: string; HIGH: string }
): string {
  if (thresholds.medium !== undefined && mapping.MEDIUM !== undefined) {
    if (value < thresholds.medium) return mapping.LOW;
    else if (value < thresholds.high) return mapping.MEDIUM;
    else return mapping.HIGH;
  } else {
    return value < thresholds.high ? mapping.LOW : mapping.HIGH;
  }
}
