---
name: brand-extractor
description: Extract comprehensive brand identity from any website using Firecrawl API. Use when you need to scrape brand data including colors, typography, fonts, images (logos, hero images), UI components, spacing, and styling information from a website. Triggers include brand scraping, extracting brand data, analyzing website design, or pulling brand guidelines from a URL.
---

# Brand Extractor

Extract comprehensive brand identity and design system information from any website using the Firecrawl API.

## Quick Start

Scrape brand data from a website:

```bash
python scripts/scrape_brand_data.py https://example.com --output-dir ./brand_data
```

Generate formatted brand guidelines:

```bash
python scripts/generate_brand_guidelines.py ./brand_data/example.com_brand_data.json
```

## What Gets Extracted

- **Colors**: Primary, secondary, accent, background, text, semantic colors
- **Typography**: Font families, sizes, weights, line heights
- **Fonts**: All detected font families used on the page
- **Images**: Logos, hero images, screenshots, favicons, og:images
- **UI Components**: Button styles, input styles, component patterns
- **Spacing**: Base units, border radius, padding, margins
- **Layout**: Grid systems, max widths, header/footer heights
- **Personality**: Brand tone, energy, target audience

## Setup

### Requirements

Install the Firecrawl Python package:

```bash
pip install firecrawl-py
```

### API Key

Set your Firecrawl API key as an environment variable:

```bash
export FIRECRAWL_API_KEY=fc-YOUR_API_KEY
```

Or pass it directly to the script:

```bash
python scripts/scrape_brand_data.py https://example.com --api-key fc-YOUR_API_KEY
```

## Usage

### 1. Scrape Brand Data

Extract brand data from a website:

```bash
python scripts/scrape_brand_data.py https://firecrawl.dev --output-dir ./firecrawl_brand
```

**Output files:**
- `{domain}_brand_data.json` - Complete brand data in JSON format
- `{domain}_screenshot.png` - Full page screenshot
- `{domain}_logo.{ext}` - Downloaded logo file

### 2. Generate Brand Guidelines

Create a formatted markdown brand guidelines document:

```bash
python scripts/generate_brand_guidelines.py ./firecrawl_brand/firecrawl.dev_brand_data.json
```

**Output:**
- `{domain}_brand_guidelines.md` - Comprehensive brand guidelines document

The generated guidelines include:
- Color palettes with hex and RGB values
- Typography system documentation
- Font family listings
- Spacing and layout specifications
- UI component styles
- Brand personality traits
- Links to brand images

### Complete Workflow

```bash
# 1. Scrape brand data
python scripts/scrape_brand_data.py https://firecrawl.dev --output-dir ./brand_data

# 2. Generate brand guidelines
python scripts/generate_brand_guidelines.py ./brand_data/firecrawl.dev_brand_data.json

# Result: brand_data/firecrawl.dev_brand_guidelines.md
```

## Advanced Usage

For detailed API documentation, advanced options, and troubleshooting, see [references/firecrawl_api.md](references/firecrawl_api.md).

**Advanced features:**
- Combine multiple formats: `branding`, `screenshot`, `images`, `markdown`
- Control caching with `maxAge` parameter
- Handle rate limits and errors gracefully
- Download and save brand assets locally
- Batch scraping multiple URLs

## Use Cases

- **Design System Analysis**: Extract and document existing design systems
- **Competitive Research**: Analyze competitor brand identities
- **Website Rebuilds**: Capture brand data before redesigning
- **Brand Monitoring**: Track brand consistency across properties
- **Client Onboarding**: Quickly document client brand guidelines
