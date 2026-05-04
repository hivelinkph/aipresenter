#!/usr/bin/env python3
"""
Generate a formatted brand guidelines markdown file from scraped brand data.

Usage:
    python generate_brand_guidelines.py <brand_data.json> [--output <file>]

Example:
    python generate_brand_guidelines.py firecrawl.dev_brand_data.json --output brand_guidelines.md
"""

import json
import argparse
from pathlib import Path
from urllib.parse import urlparse


def hex_to_rgb(hex_color):
    """Convert hex color to RGB tuple."""
    if not hex_color or not hex_color.startswith("#"):
        return None
    hex_color = hex_color.lstrip("#")
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))


def generate_color_block(color_name, hex_color):
    """Generate a markdown representation of a color."""
    if not hex_color:
        return ""
    
    rgb = hex_to_rgb(hex_color)
    rgb_str = f"RGB({rgb[0]}, {rgb[1]}, {rgb[2]})" if rgb else ""
    
    return f"- **{color_name}**: `{hex_color}` {rgb_str}"


def generate_brand_guidelines(brand_data_path, output_path=None):
    """
    Generate a formatted brand guidelines markdown file.
    
    Args:
        brand_data_path: Path to the JSON file with scraped brand data
        output_path: Path for the output markdown file
    """
    # Load brand data
    with open(brand_data_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    branding = data.get("data", {}).get("branding", {})
    metadata = data.get("data", {}).get("metadata", {})
    
    if not branding:
        print("Error: No branding data found in input file")
        return
    
    # Extract domain for title
    source_url = metadata.get("sourceURL", "")
    domain = urlparse(source_url).netloc.replace("www.", "") if source_url else "Website"
    
    # Determine output path
    if not output_path:
        output_path = Path(brand_data_path).parent / f"{domain}_brand_guidelines.md"
    
    # Build markdown content
    md_lines = []
    
    # Header
    md_lines.append(f"# {domain.title()} Brand Guidelines")
    md_lines.append("")
    md_lines.append(f"*Extracted from: [{source_url}]({source_url})*")
    md_lines.append("")
    
    # Overview
    if branding.get("colorScheme") or branding.get("personality"):
        md_lines.append("## Overview")
        md_lines.append("")
        
        if branding.get("colorScheme"):
            md_lines.append(f"**Color Scheme**: {branding['colorScheme'].title()}")
            md_lines.append("")
        
        if branding.get("personality"):
            personality = branding["personality"]
            if personality.get("tone"):
                md_lines.append(f"**Brand Tone**: {personality['tone']}")
            if personality.get("energy"):
                md_lines.append(f"**Energy Level**: {personality['energy']}")
            if personality.get("targetAudience"):
                md_lines.append(f"**Target Audience**: {personality['targetAudience']}")
            md_lines.append("")
    
    # Colors
    colors = branding.get("colors", {})
    if colors:
        md_lines.append("## Color Palette")
        md_lines.append("")
        
        # Main colors
        if any(colors.get(k) for k in ["primary", "secondary", "accent"]):
            md_lines.append("### Main Colors")
            md_lines.append("")
            if colors.get("primary"):
                md_lines.append(generate_color_block("Primary", colors["primary"]))
            if colors.get("secondary"):
                md_lines.append(generate_color_block("Secondary", colors["secondary"]))
            if colors.get("accent"):
                md_lines.append(generate_color_block("Accent", colors["accent"]))
            md_lines.append("")
        
        # Background & Text colors
        if any(colors.get(k) for k in ["background", "textPrimary", "textSecondary"]):
            md_lines.append("### Background & Text")
            md_lines.append("")
            if colors.get("background"):
                md_lines.append(generate_color_block("Background", colors["background"]))
            if colors.get("textPrimary"):
                md_lines.append(generate_color_block("Primary Text", colors["textPrimary"]))
            if colors.get("textSecondary"):
                md_lines.append(generate_color_block("Secondary Text", colors["textSecondary"]))
            md_lines.append("")
        
        # Semantic colors
        if any(colors.get(k) for k in ["link", "success", "warning", "error"]):
            md_lines.append("### Semantic Colors")
            md_lines.append("")
            if colors.get("link"):
                md_lines.append(generate_color_block("Link", colors["link"]))
            if colors.get("success"):
                md_lines.append(generate_color_block("Success", colors["success"]))
            if colors.get("warning"):
                md_lines.append(generate_color_block("Warning", colors["warning"]))
            if colors.get("error"):
                md_lines.append(generate_color_block("Error", colors["error"]))
            md_lines.append("")
    
    # Typography
    typography = branding.get("typography", {})
    if typography:
        md_lines.append("## Typography")
        md_lines.append("")
        
        # Font families
        font_families = typography.get("fontFamilies", {})
        if font_families:
            md_lines.append("### Font Families")
            md_lines.append("")
            if font_families.get("primary"):
                md_lines.append(f"- **Primary**: {font_families['primary']}")
            if font_families.get("heading"):
                md_lines.append(f"- **Headings**: {font_families['heading']}")
            if font_families.get("code"):
                md_lines.append(f"- **Code**: {font_families['code']}")
            md_lines.append("")
        
        # Font sizes
        font_sizes = typography.get("fontSizes", {})
        if font_sizes:
            md_lines.append("### Font Sizes")
            md_lines.append("")
            for key, value in font_sizes.items():
                md_lines.append(f"- **{key.upper()}**: {value}")
            md_lines.append("")
        
        # Font weights
        font_weights = typography.get("fontWeights", {})
        if font_weights:
            md_lines.append("### Font Weights")
            md_lines.append("")
            for key, value in font_weights.items():
                md_lines.append(f"- **{key.title()}**: {value}")
            md_lines.append("")
        
        # Line heights
        line_heights = typography.get("lineHeights", {})
        if line_heights:
            md_lines.append("### Line Heights")
            md_lines.append("")
            for key, value in line_heights.items():
                md_lines.append(f"- **{key.title()}**: {value}")
            md_lines.append("")
    
    # Fonts list
    fonts = branding.get("fonts", [])
    if fonts:
        md_lines.append("## Detected Fonts")
        md_lines.append("")
        for font in fonts:
            if isinstance(font, dict) and font.get("family"):
                md_lines.append(f"- {font['family']}")
            elif isinstance(font, str):
                md_lines.append(f"- {font}")
        md_lines.append("")
    
    # Spacing
    spacing = branding.get("spacing", {})
    if spacing:
        md_lines.append("## Spacing & Layout")
        md_lines.append("")
        if spacing.get("baseUnit"):
            md_lines.append(f"- **Base Unit**: {spacing['baseUnit']}px")
        if spacing.get("borderRadius"):
            md_lines.append(f"- **Border Radius**: {spacing['borderRadius']}")
        if spacing.get("padding"):
            md_lines.append(f"- **Padding**: {spacing['padding']}")
        if spacing.get("margins"):
            md_lines.append(f"- **Margins**: {spacing['margins']}")
        md_lines.append("")
    
    # Components
    components = branding.get("components", {})
    if components:
        md_lines.append("## UI Components")
        md_lines.append("")
        
        for comp_name, comp_data in components.items():
            if not comp_data:
                continue
            
            # Format component name
            formatted_name = comp_name.replace("button", "Button").replace("input", "Input")
            md_lines.append(f"### {formatted_name}")
            md_lines.append("")
            
            if isinstance(comp_data, dict):
                for key, value in comp_data.items():
                    formatted_key = key.replace("textColor", "Text Color").replace("borderColor", "Border Color").replace("borderRadius", "Border Radius")
                    md_lines.append(f"- **{formatted_key.title()}**: {value}")
            md_lines.append("")
    
    # Images
    images = branding.get("images", {})
    if images:
        md_lines.append("## Brand Images")
        md_lines.append("")
        
        if images.get("logo"):
            md_lines.append(f"- **Logo**: {images['logo']}")
        if images.get("favicon"):
            md_lines.append(f"- **Favicon**: {images['favicon']}")
        if images.get("ogImage"):
            md_lines.append(f"- **Social Image**: {images['ogImage']}")
        md_lines.append("")
    
    # Write output file
    output_path = Path(output_path)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(md_lines))
    
    print(f"✓ Brand guidelines generated: {output_path.absolute()}")
    return output_path


def main():
    parser = argparse.ArgumentParser(
        description="Generate brand guidelines markdown from scraped brand data"
    )
    parser.add_argument("brand_data", help="Path to brand data JSON file")
    parser.add_argument(
        "--output",
        help="Output markdown file path (default: auto-generated)"
    )
    
    args = parser.parse_args()
    
    generate_brand_guidelines(args.brand_data, args.output)


if __name__ == "__main__":
    main()
