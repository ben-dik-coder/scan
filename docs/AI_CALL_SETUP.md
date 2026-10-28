# AI Call Center — setup (ElevenLabs)

NyLead kan starte automatiske utgående samtaler fra `/app/ring`.

**Anbefalt:** ElevenLabs Agents + Twilio (samme agent du har laget i ElevenLabs).
**Fallback:** Vapi (hvis ElevenLabs-nøklene ikke er satt).

## 1. ElevenLabs-agent

1. Lag / bruk agenten i [ElevenLabs Agents](https://elevenlabs.io/app/agents)
2. Bruk dynamiske variabler i prompten hvis du vil (NyLead sender dem per kall):
   - `{{companyName}}`, `{{contactName}}`, `{{municipality}}`
   - `{{sellerCompanyName}}`, `{{phone}}`, `{{email}}`, `{{hasWebsite}}`
   - `{{ai_call_id}}`, `{{orgnr}}` (brukes internt til webhook-matching)

## 2. Twilio-nummer i ElevenLabs

1. Ha et Twilio-nummer (kjøpt i Twilio, eller verified caller ID for kun outbound)
2. I ElevenLabs: **Phone numbers** → importer Twilio-nummeret (Account SID + Auth Token)
3. Knytt nummeret til agenten (inbound) — outbound bruker `agent_phone_number_id`

## 3. Env

I `.env.local`:

```bash
ELEVENLABS_API_KEY=...
ELEVENLABS_AGENT_ID=agent_...
ELEVENLABS_AGENT_PHONE_NUMBER_ID=...   # ID fra ElevenLabs phone numbers, ikke selve +47…
ELEVENLABS_WEBHOOK_SECRET=...          # fra post-call webhook i ElevenLabs
NEXT_PUBLIC_APP_URL=https://dittdomene.no

# Valgfritt: overstyr agent-prompt med NyLead-script (default: av — behold din agent)
# ELEVENLABS_OVERRIDE_PROMPT=0
```

Finn `ELEVENLABS_AGENT_PHONE_NUMBER_ID` i ElevenLabs under Phone numbers (UUID/id for importert nummer).

## 4. Webhook (etter samtale)

I ElevenLabs workspace → Agents settings → **Post-call webhooks**:

- URL: `{NEXT_PUBLIC_APP_URL}/api/ai-call/webhook`
- Aktiver minst `post_call_transcription` (og gjerne `call_initiation_failure`)
- Kopier webhook-secret → `ELEVENLABS_WEBHOOK_SECRET`

NyLead verifiserer `ElevenLabs-Signature` (HMAC) og oppdaterer lead-status.

## 5. Database

Kjør migrasjon `supabase/migrations/023_ai_calls.sql` hvis den ikke allerede er kjørt.
`ai_calls.vapi_call_id` lagrer ElevenLabs `conversation_id` (eller Vapi call id).

## 6. Test

1. `npm run dev`
2. Legg et AS med telefon i arbeidskøen
3. Åpne `/app/ring` → **AI ring**
4. ElevenLabs ringer ut automatisk med agenten din
5. Etter samtale: webhook oppdaterer status (`moete_booket` / `ikke_interessert` / `kontaktet`)

## Vapi-fallback

Hvis ElevenLabs-env mangler, brukes Vapi:

```bash
VAPI_API_KEY=...
VAPI_ASSISTANT_ID=...
VAPI_PHONE_NUMBER_ID=...
AI_CALL_WEBHOOK_SECRET=...
```

## Merknader

- MVP: én aktiv AI-samtale om gangen per bruker
- Demo-modus støtter ikke AI-ring
- Prompten i ElevenLabs brukes som den er, med mindre `ELEVENLABS_OVERRIDE_PROMPT=1`
