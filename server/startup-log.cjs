/**
 * Preload for `node -r ./startup-log.cjs index.js` — umiddelbar tilbakemelding
 * før tunge ESM-imports er ferdige.
 */
const cwd = process.cwd()
const icloudRisk =
  /Desktop|Documents|iCloud|Mobile Documents/i.test(cwd)
if (icloudRisk) {
  console.warn(
    '\n[!] Prosjektmappen ser ut til å ligge der iCloud kan synke filer. ' +
      'Da får Node ofte ETIMEDOUT ved lesing av node_modules.\n' +
      '    Løsning: flytt hele «count-clicker» til f.eks. ~/Developer/count-clicker ' +
      '(utenfor Skrivebord/Dokumenter), kjør npm install på nytt.\n',
  )
}
console.log(
  'Scanix API: laster moduler (noen sekunder er normalt – vent på linjen «lytter» …)',
)
