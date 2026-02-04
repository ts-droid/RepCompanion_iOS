# Affiliate & Reklam Integration Guide

## Översikt

Fitness-appen har ett intelligent system för att visa relevanta annonser och affiliate-länkar baserat på de träningsråd användaren ser. Detta maximerar konvertering genom kontextuell relevans.

## Hur det fungerar

### 1. Träningsråd → Annonser Koppling

Varje träningsråd (TrainingTip) har ett `relatedPromoPlacement` fält som kopplar tipset till en specifik annonsplacement. När tipset visas för användaren, visas även relaterad annons automatiskt.

### 2. Placement-nycklar

Följande placement-nycklar är implementerade:

| Placement Key | Kategori | Rekommenderade Produkter/Affiliates |
|--------------|----------|-------------------------------------|
| `tip-recovery` | Återhämtning | Sovhjälpmedel, foam rollers, massage guns, magnesiumtillskott, proteintillskott |
| `tip-nutrition` | Näring | Proteinpulver, måltidsersättning, kosttillskott, kokböcker |
| `tip-hydration` | Hydrering | Vattenflaskor, elektrolyter, sports drinks, hydreringspaket |
| `tip-progression` | Progression | Gym-utrustning, vikter, resistance bands, träningskläder |
| `tip-safety` | Säkerhet | Skyddsutrustning, bälten, handledsstöd, instrukti

onsvideos |
| `tip-motivation` | Motivation | Fitness trackers, pulsmätare, träningsappar, böcker |
| `tip-sport-specific` | Sportspecifikt | Sport-specifik utrustning baserat på användarens sport |

### 3. Exempel på Kontextuell Matching

**Recovery Tip (😴):**
```
Tips: "Som 53-åring är återhämtning avgörande. Sova 7-8 timmar..."
Annons: "Premium Foam Roller - 30% rabatt via vår partner RecoveryPro"
```

**Nutrition Tip (🍗):**
```
Tips: "Med 4 pass per vecka behöver din kropp tillräckligt bränsle..."
Annons: "Whey Protein Isolate - Högsta kvalitet från våra partners på ProteinKungen"
```

**Hydration Tip (💧):**
```
Tips: "Hydrering påverkar prestanda mer än du tror..."
Annons: "Hydroflask 1L - Perfekt för träning. Köp via vår länk!"
```

## Så lägger du till annonser

### Steg 1: Lägg till annons i databasen

Använd backend API eller databas-verktyget för att lägga till promo content:

```typescript
// Exempel: Lägg till protein powder annons
{
  type: "affiliate",
  placement: "tip-nutrition",  // Matchar nutrition tips
  title: "Premium Whey Protein",
  description: "Högsta kvalitet protein för optimal återhämtning. 30% rabatt med kod FITNESS30",
  ctaText: "Köp nu och spara 30%",
  ctaUrl: "https://partner.com/protein?ref=yourapp",
  partnerName: "ProteinKungen",
  imageUrl: "https://cdn.partner.com/protein.jpg",
  targetingRules: {
    // Optional: Ytterligare targeting baserat på användarprofil
    minAge: 18,
    goals: ["strength", "volume"]
  },
  isActive: true,
  frequencyCapHours: 24  // Visa max 1 gång per 24h per användare
}
```

### Steg 2: Targeting Rules (Valfritt)

För mer avancerad targeting kan du använda `targetingRules` JSON-fält:

```typescript
targetingRules: {
  // Ålder
  minAge: 40,
  maxAge: 65,
  
  // Mål (från profile.goalStrength, goalVolume, etc)
  goals: ["strength", "volume"],
  
  // Träningsnivå
  trainingLevel: ["intermediate", "advanced"],
  
  // Sport
  sports: ["Fotboll", "Hockey"],
  
  // Motivation
  motivationType: ["Sport", "Fitness"]
}
```

### Steg 3: Testa annonsen

1. Navigera till Dashboard
2. Kolla vilket träningsråd som visas
3. Verifiera att relaterad annons dyker upp under tipset
4. Klicka på CTA-knappen och verifiera att:
   - Affiliate-klicket loggas i databasen
   - Användaren redirectas till rätt URL
   - Partnern får korrekt attribution

## Tracking & Analytics

### Impressions (Visningar)

Varje gång en annons visas loggas det automatiskt i `promo_impressions` **med metadata om vilket tips som genererade visningen**:

```typescript
{
  userId: "user-123",
  promoId: "promo-456",
  placement: "tip-nutrition",
  metadata: { 
    tipId: "nutrition-protein",
    tipCategory: "nutrition"
  },
  createdAt: "2024-11-15T10:30:00Z"
}
```

Detta gör det möjligt att analysera vilka tips som driver mest konvertering!

### Clicks (Klick)

När användare klickar på affiliate-länk loggas det i `affiliate_clicks` **med samma metadata**:

```typescript
{
  userId: "user-123",
  promoId: "promo-456",
  clickedUrl: "https://partner.com/protein?ref=yourapp",
  metadata: { 
    tipId: "nutrition-protein",
    tipCategory: "nutrition"
  },
  createdAt: "2024-11-15T10:31:00Z"
}
```

### Analysera Performance

```sql
-- CTR per placement
SELECT 
  p.placement,
  COUNT(DISTINCT pi.id) as impressions,
  COUNT(DISTINCT ac.id) as clicks,
  ROUND(COUNT(DISTINCT ac.id)::numeric / NULLIF(COUNT(DISTINCT pi.id), 0) * 100, 2) as ctr_percent
FROM promo_content p
LEFT JOIN promo_impressions pi ON p.id = pi.promo_id
LEFT JOIN affiliate_clicks ac ON p.id = ac.promo_id
GROUP BY p.placement
ORDER BY ctr_percent DESC;

-- Bäst presterande annonser
SELECT 
  p.title,
  p.partner_name,
  p.placement,
  COUNT(DISTINCT ac.id) as total_clicks,
  COUNT(DISTINCT pi.user_id) as unique_users
FROM promo_content p
LEFT JOIN promo_impressions pi ON p.id = pi.promo_id
LEFT JOIN affiliate_clicks ac ON p.id = ac.promo_id
WHERE p.is_active = true
GROUP BY p.id, p.title, p.partner_name, p.placement
ORDER BY total_clicks DESC
LIMIT 10;

-- Vilka träningsråd driver mest konvertering?
SELECT 
  pi.metadata->>'tipCategory' as tip_category,
  pi.metadata->>'tipId' as tip_id,
  COUNT(DISTINCT pi.id) as impressions,
  COUNT(DISTINCT ac.id) as clicks,
  ROUND(COUNT(DISTINCT ac.id)::numeric / NULLIF(COUNT(DISTINCT pi.id), 0) * 100, 2) as ctr_percent
FROM promo_impressions pi
LEFT JOIN affiliate_clicks ac ON pi.promo_id = ac.promo_id 
  AND pi.metadata->>'tipId' = ac.metadata->>'tipId'
WHERE pi.metadata IS NOT NULL
GROUP BY pi.metadata->>'tipCategory', pi.metadata->>'tipId'
ORDER BY ctr_percent DESC, impressions DESC
LIMIT 20;
```

## Best Practices

### 1. Relevans är nyckeln
- **GÖR**: Matcha produkter exakt till tipsets kategori
  - Recovery tips → Recovery produkter
  - Nutrition tips → Nutrition produkter
- **GÖR INTE**: Visa allmänna annonser som inte relaterar till tipset

### 2. Värde för användaren först
- Annonser ska vara genuint hjälpsamma, inte bara säljande
- Erbjud reella rabatter via affiliate-länkar
- Välj kvalitetsprodukter som faktiskt hjälper användarna

### 3. Frequency Capping
- Använd `frequencyCapHours` för att inte övervälda användare
- Rekommenderat: 24 timmar för de flesta annonser
- Undvik att visa samma annons flera gånger per dag

### 4. A/B Testning
För samma placement, skapa flera annonsvarianter:
```typescript
// Variant A
placement: "tip-nutrition"
title: "Premium Protein - 30% rabatt"

// Variant B  
placement: "tip-nutrition"
title: "Bygg muskler snabbare med premium protein"
```

Backend API väljer slumpmässigt och loggar vilken variant som visas, så du kan analysera vilken som konverterar bäst.

### 5. Säsongsanpassning
- **Vinter**: Recovery produkter (D-vitamin, magnesium)
- **Sommar**: Hydration produkter, outdoor gear
- **Nyår**: Målinriktade produkter (scales, meal prep containers)

## Kommande Förbättringar

### Planerat att implementera:

1. **Promo Rotation per Placement**
   - **Nuläge**: Om flera annonser finns för samma placement (t.ex. `tip-nutrition`) visas alltid den första
   - **Förbättring**: Rotera mellan tillgängliga annonser baserat på:
     - Round-robin (jämn fördelning)
     - Weighted distribution (baserat på tidigare CTR)
     - User-specific (visa olika annonser till olika användare)
   - Detta maximerar testning av olika budskap och förhindrar ad fatigue

2. **Machine Learning Targeting**
   - Använd klick-historik för att förutsäga vilka annonser användaren klickar på
   - Personalisera baserat på tidigare beteende

3. **Native Advertising**
   - Integrera annonser direkt i workout sessions
   - Visa utrustning som används i specifika övningar

3. **Retargeting**
   - Om användare klickar men inte köper, visa relaterade erbjudanden senare
   - Email follow-ups för abandoned carts

4. **Partner Dashboard**
   - Låt partners se sina egna analytics
   - Self-service för att uppdatera annonser

5. **Premium utan annonser**
   - Users med premium subscription ser inga annonser
   - Flagga finns redan i `user_subscriptions` table

## API Endpoints

### Hämta annons för placement
```
GET /api/promos/{placement}
Response: PromoContent | null
```

### Logga impression
```
POST /api/promos/{promoId}/impression
Body: { 
  placement: string,
  metadata?: Record<string, unknown>  // Optional: tipId, tipCategory, etc.
}
Response: { success: boolean }
```

**Exempel:**
```typescript
// Frontend skickar metadata automatiskt
POST /api/promos/promo-123/impression
{
  placement: "tip-nutrition",
  metadata: {
    tipId: "nutrition-protein",
    tipCategory: "nutrition"
  }
}
```

### Logga affiliate click
```
POST /api/affiliate/click/{promoId}
Body: { 
  metadata?: Record<string, unknown>  // Optional: tipId, tipCategory, etc.
}
Response: { redirectUrl: string }
```

**Exempel:**
```typescript
// Frontend skickar metadata automatiskt
POST /api/affiliate/click/promo-123
{
  metadata: {
    tipId: "nutrition-protein",
    tipCategory: "nutrition"
  }
}
```

## Support

För frågor om affiliate-systemet, kontakta utvecklingsteamet eller läs koden i:
- `client/src/lib/trainingTips.ts` - Tip → Placement mapping
- `client/src/components/PromoCard.tsx` - Annonsvisning
- `server/routes.ts` - API endpoints för promos
- `shared/schema.ts` - Databas-schema

---

**Tips**: Börja med 2-3 high-quality partners per kategori och expandera baserat på performance data! 🚀
