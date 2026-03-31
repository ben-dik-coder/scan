# Git push til GitHub (fullfør lokalt)

**Allerede gjort her:** `git init` i `count-clicker` (repoet peker nå på denne mappen, ikke hele hjemmemappen). **`.gitignore`** er opprettet.

**Ikke fullført automatisk:** `git add` for hele prosjektet feilet med *Operation timed out* på mange filer – typisk når **iCloud** ikke har lastet ned filene til disken ennå. Du må kjøre `git add` / `git push` **på din Mac** når filene er tilgjengelige lokalt (se under).

Automatisk `git add` feilet her fordi filer på disk ikke lot seg lese (ofte **iCloud** med «Optimaliser Mac-lagring» – filer er bare plassholdere til de er lastet ned).

## Før du kjører kommandoer

1. **Last ned prosjektfiler lokalt:** I Finder, høyreklikk mappen `count-clicker` → **Last ned nå** (hvis tilgjengelig), eller flytt prosjektet til en mappe **uten** iCloud (f.eks. `~/Prosjekter/count-clicker`).
2. Eller: **Systeminnstillinger → Apple-ID → iCloud → iCloud Drive** og slå av optimalisering for Skrivebord/Dokumenter midlertidig.

## Kjør i Terminal (i denne mappen)

```bash
cd "/Users/ben/Desktop/Skred beisfjord/count-clicker"

git add .
git status

git commit -m "Full Scanix: src, server, Vite"

git remote add origin https://github.com/ben-dik-coder/scan.git
# Hvis remote finnes fra før: git remote set-url origin https://github.com/ben-dik-coder/scan.git

git branch -M main
git push -u origin main
```

Hvis `git push` sier at historikken på GitHub er annerledes:

```bash
git pull origin main --rebase --allow-unrelated-histories
# løs eventuelle konflikter, deretter:
git push -u origin main
```

Eller (overskriver GitHub – kun hvis du er sikker):

```bash
git push -u origin main --force
```

Etter vellykket push: sjekk https://github.com/ben-dik-coder/scan og kjør **Deploy** på Render.

**Merk:** Hvis du tidligere hadde Git knyttet til hele hjemmemappen (`/Users/ben/.git`), bør den fjernes av en som vet hva de gjør – spør evt. om hjelp. Prosjekt-repoet ligger nå kun i `count-clicker/.git`.
