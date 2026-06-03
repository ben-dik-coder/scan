/** Del store `.in("orgnr", …)`-spørringer for å unngå timeout og URI-grenser. */
export async function forEachOrgnrBatch<T>(
  orgnrs: string[],
  batchSize: number,
  run: (batch: string[]) => Promise<T[]>
): Promise<T[]> {
  if (orgnrs.length === 0) return [];
  const out: T[] = [];
  for (let i = 0; i < orgnrs.length; i += batchSize) {
    const batch = orgnrs.slice(i, i + batchSize);
    const rows = await run(batch);
    out.push(...rows);
  }
  return out;
}
