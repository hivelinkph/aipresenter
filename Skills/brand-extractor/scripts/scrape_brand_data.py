#!/usr/bin/env python3
"""
Scrape brand data from a website using Firecrawl API.

Usage:
    python scrape_brand_data.py <url> [--output-dir <dir>]

Example:
    python scrape_brand_data.py https://firecrawl.dev --output-dir ./brand_data
"""

import os
import sys
import json
import argparse
import requests
from pathlib import Path
from urllib.parse import urlparse
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


def scrape_brand_data(url, api_key, output_dir="."):
    """
    Scrape brand data from a URL using Firecrawl API.
    
    Args:
        url: The URL to scrape
        api_key: Firecrawl API key
        output_dir: Directory to save output files
        
    Returns:
        dict: The scraped brand data
    """
    # Create output directory
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    # Prepare API request
    api_url = "https://api.firecrawl.dev/v2/scrape"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "url": url,
        "formats": ["branding", "screenshot", "images", "markdown"]
    }
    
    print(f"Scraping brand data from: {url}")
    
    # Make API request
    response = requests.post(api_url, headers=headers, json=payload)
    
    if response.status_code != 200:
        print(f"Error: API request failed with status {response.status_code}")
        print(f"Response: {response.text}")
        sys.exit(1)
    
    data = response.json()
    
    if not data.get("success"):
        print(f"Error: API returned unsuccessful response")
        print(f"Response: {json.dumps(data, indent=2)}")
        sys.exit(1)
    
    # Extract domain name for file naming
    domain = urlparse(url).netloc.replace("www.", "")
    
    # Save full response
    output_file = output_path / f"{domain}_brand_data.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    print(f"✓ Saved brand data to: {output_file}")
    
    # Save screenshot if available
    if "screenshot" in data.get("data", {}):
        screenshot_url = data["data"]["screenshot"]
        screenshot_file = output_path / f"{domain}_screenshot.png"
        
        print(f"Downloading screenshot...")
        screenshot_response = requests.get(screenshot_url)
        if screenshot_response.status_code == 200:
            with open(screenshot_file, "wb") as f:
                f.write(screenshot_response.content)
            print(f"✓ Saved screenshot to: {screenshot_file}")
    
    # Download logo if available
    branding = data.get("data", {}).get("branding", {})
    if branding.get("logo"):
        logo_url = branding["logo"]
        logo_ext = Path(logo_url).suffix or ".png"
        logo_file = output_path / f"{domain}_logo{logo_ext}"
        
        print(f"Downloading logo...")
        try:
            logo_response = requests.get(logo_url)
            if logo_response.status_code == 200:
                with open(logo_file, "wb") as f:
                    f.write(logo_response.content)
                print(f"✓ Saved logo to: {logo_file}")
        except Exception as e:
            print(f"Warning: Could not download logo: {e}")
    
    print(f"\n✓ Brand data extraction complete!")
    print(f"  Output directory: {output_path.absolute()}")
    
    return data


def main():
    parser = argparse.ArgumentParser(
        description="Scrape brand data from a website using Firecrawl API"
    )
    parser.add_argument("url", help="URL to scrape")
    parser.add_argument(
        "--output-dir",
        default=".",
        help="Output directory for saved files (default: current directory)"
    )
    parser.add_argument(
        "--api-key",
        help="Firecrawl API key (or set FIRECRAWL_API_KEY env var)"
    )
    
    args = parser.parse_args()
    
    # Get API key
    api_key = args.api_key or os.getenv("FIRECRAWL_API_KEY")
    if not api_key:
        print("Error: Firecrawl API key required")
        print("Set FIRECRAWL_API_KEY environment variable or use --api-key")
        sys.exit(1)
    
    # Scrape brand data
    scrape_brand_data(args.url, api_key, args.output_dir)


if __name__ == "__main__":
    main()
