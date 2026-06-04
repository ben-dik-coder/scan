# Webhook til Zapier / Make / CRM

NyLead kan sende JSON til en URL du legger inn under **Innstillinger → Integrasjoner**.

## Når sendes webhook?

| Hendelse | `event` | Når |
|----------|---------|-----|
| Lead i arbeidskø | `lead.queued` | Du legger firma i kø (status «ny») fra Skann eller arbeidskø |
| CSV-eksport | `export` | Du eksporterer valgte firma og huker av webhook |

## Zapier (enklest)

1. Lag en **Zap** med trigger **Webhooks by Zapier → Catch Hook**.
2. Kopier webhook-URL til NyLead under Innstillinger.
3. I NyLead: legg et firma i arbeidskø (eller eksporter CSV med webhook).
4. I Zapier: «Test trigger» skal vise JSON.
5. Legg til action, f.eks. **HubSpot Create Contact** eller **Pipedrive Create Person**.

## Eksempel `lead.queued`

```json
{
  "event": "lead.queued",
  "queuedAt": "2026-06-02T10:00:00.000Z",
  "lead": {
    "orgnr": "123456789",
    "name": "EKSEMPEL AS",
    "email": "post@eksempel.no",
    "phone": "99999999",
    "municipalityName": "OSLO",
    "registeredAt": "2026-06-01",
    "score": 85,
    "status": "ny"
  }
}
```

## Make (Integromat)

Samme som Zapier: modul **Webhooks → Custom webhook**, metode POST, body JSON.

## Feilsøking

- URL må starte med `https://`
- Zapier må være **på** (Zap enabled)
- Webhook sendes bare når lead **ny** legges i kø — ikke ved hver statusendring
