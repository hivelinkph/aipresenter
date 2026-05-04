# Firecrawl API - Branding Format Reference

## Overview

The Firecrawl API's `branding` format extracts comprehensive brand identity information from webpages, including colors, fonts, typography, spacing, UI components, and more.

## API Endpoint

```
POST https://api.firecrawl.dev/v2/scrape
```

## Authentication

Include your API key in the Authorization header:

```
Authorization: Bearer fc-YOUR_API_KEY
```

## Request Format

```json
{
  "url": "https://example.com",
  "formats": ["branding"]
}
```

### Combining Formats

You can request multiple formats simultaneously:

```json
{
  "url": "https://example.com",
  "formats": ["branding", "screenshot", "images", "markdown"]
}
```

## Response Structure

### Success Response

```json
{
  "success": true,
  "data": {
    "branding": {
      "colorScheme": "dark",
      "logo": "https://example.com/logo.svg",
      "colors": { ... },
      "fonts": [ ... ],
      "typography": { ... },
      "spacing": { ... },
      "components": { ... },
      "images": { ... },
      "animations": { ... },
      "layout": { ... },
      "personality": { ... }
    },
    "metadata": {
      "title": "Page Title",
      "sourceURL": "https://example.com",
      "statusCode": 200
    }
  }
}
```

## Branding Object Properties

### colorScheme
- Type: `string`
- Values: `"light"` or `"dark"`
- The detected color scheme of the website

### logo
- Type: `string` (URL)
- URL of the primary logo image

### colors
Object containing brand colors:

```json
{
  "primary": "#FF6B35",
  "secondary": "#004E89",
  "accent": "#F77F00",
  "background": "#1A1A1A",
  "textPrimary": "#FFFFFF",
  "textSecondary": "#B0B0B0",
  "link": "#3B82F6",
  "success": "#10B981",
  "warning": "#F59E0B",
  "error": "#EF4444"
}
```

### fonts
Array of font families used:

```json
[
  { "family": "Inter" },
  { "family": "Roboto Mono" }
]
```

### typography
Detailed typography information:

```json
{
  "fontFamilies": {
    "primary": "Inter",
    "heading": "Inter",
    "code": "Roboto Mono"
  },
  "fontSizes": {
    "h1": "48px",
    "h2": "36px",
    "h3": "24px",
    "body": "16px"
  },
  "fontWeights": {
    "light": 300,
    "regular": 400,
    "medium": 500,
    "bold": 700
  },
  "lineHeights": {
    "tight": "1.2",
    "normal": "1.5",
    "relaxed": "1.75"
  }
}
```

### spacing
Spacing and layout information:

```json
{
  "baseUnit": 8,
  "borderRadius": "8px",
  "padding": "16px",
  "margins": "24px"
}
```

### components
UI component styles:

```json
{
  "buttonPrimary": {
    "background": "#FF6B35",
    "textColor": "#FFFFFF",
    "borderRadius": "8px"
  },
  "buttonSecondary": {
    "background": "transparent",
    "textColor": "#FF6B35",
    "borderColor": "#FF6B35",
    "borderRadius": "8px"
  },
  "input": {
    "background": "#FFFFFF",
    "borderColor": "#E5E7EB",
    "borderRadius": "6px"
  }
}
```

### images
Brand images:

```json
{
  "logo": "https://example.com/logo.svg",
  "favicon": "https://example.com/favicon.ico",
  "ogImage": "https://example.com/og-image.png"
}
```

### animations
Animation and transition settings:

```json
{
  "duration": "200ms",
  "easing": "ease-in-out"
}
```

### layout
Layout configuration:

```json
{
  "maxWidth": "1280px",
  "gridColumns": 12,
  "headerHeight": "64px",
  "footerHeight": "200px"
}
```

### personality
Brand personality traits:

```json
{
  "tone": "Professional and approachable",
  "energy": "Calm and focused",
  "targetAudience": "Developers and technical teams"
}
```

## Error Handling

### Failed Request

```json
{
  "success": false,
  "error": "Error message here"
}
```

Common error codes:
- `401`: Invalid or missing API key
- `429`: Rate limit exceeded
- `500`: Server error

## Rate Limits

Rate limits depend on your Firecrawl plan. Check your plan details at https://firecrawl.dev/pricing

## Caching

By default, Firecrawl caches results for 2 days. To force fresh content:

```json
{
  "url": "https://example.com",
  "formats": ["branding"],
  "maxAge": 0
}
```

## Best Practices

1. **Combine formats**: Request `branding`, `screenshot`, and `images` together for comprehensive brand analysis
2. **Handle missing data**: Not all properties will be present for every website
3. **Cache results**: Store brand data locally to avoid unnecessary API calls
4. **Download assets**: Save logos and images locally for offline reference

## Python Example

```python
import requests
import os

api_key = os.getenv("FIRECRAWL_API_KEY")
url = "https://api.firecrawl.dev/v2/scrape"

headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json"
}

payload = {
    "url": "https://example.com",
    "formats": ["branding", "screenshot", "images"]
}

response = requests.post(url, headers=headers, json=payload)
data = response.json()

if data.get("success"):
    branding = data["data"]["branding"]
    print(f"Primary color: {branding['colors']['primary']}")
else:
    print(f"Error: {data.get('error')}")
```
