/** Bland rekkefølgen på orgnr i en lagret liste (Fisher–Yates). Ny rekkefølge hver gang. */
export function shuffleSavedListOrgnrs(orgnrs: readonly string[]): string[] {
  const arr = [...orgnrs];
  if (arr.length <= 1) return arr;

  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}
