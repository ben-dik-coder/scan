/** Ny liste/kø-flyt — kun aktiv når satt i .env.local (leke/preview). */
export function isNyleadV2Enabled(): boolean {
  return process.env.NEXT_PUBLIC_NYLEAD_V2 === "1";
}
