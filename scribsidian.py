#!/usr/bin/env python3

import os
import re
import sys
import unicodedata
from pathlib import Path

# --------------------------
# Utility Functions
# --------------------------

def slugify(text, max_length=60):
    """Convert text into a clean, lowercase, dash-separated slug."""
    text = unicodedata.normalize("NFKD", text)
    text = text.lower()
    text = re.sub(r'[^a-z0-9\s-]', '', text)
    text = re.sub(r'\s+', '-', text)
    return text[:max_length].rstrip('-')


def clean_text(text):
    """Collapse PDF line breaks and excess whitespace."""
    cleaned = text.replace("\n", " ")
    cleaned = re.sub(r'\s+', ' ', cleaned)
    return cleaned.strip()


# --------------------------
# Quote Parsing
# --------------------------

def clean_quote_text(text):
    """Clean quote text by removing embedded page markers and normalizing whitespace."""
    # Remove standalone page numbers that appear mid-quote (e.g., "Page 89")
    text = re.sub(r'Page\s+\d+\s*$', '', text)

    # Collapse PDF line breaks and excess whitespace
    text = text.replace("\n", " ")
    text = re.sub(r'\s+', ' ', text)

    return text.strip()

def parse_quotes(raw_text):
    """
    Parse Kindle highlights from raw text.

    Preprocessing step: Remove "Highlight Continued" lines to merge split quotes.
    This handles cases where a quote is split across pages with "Highlight Continued".
    """
    # Remove standalone page numbers followed by "Highlight Continued"
    # Pattern: "\n13\nPage 88 | Highlight Continued\n" → "\n"
    raw_text = re.sub(r'\n\d+\s*\nPage\s+\d+\s*\|\s*Highlight\s+Continued\s*\n', '\n', raw_text)

    # Remove any remaining "Page X | Highlight Continued" lines
    # Pattern: "\nPage 88 | Highlight Continued\n" → "\n"
    raw_text = re.sub(r'\nPage\s+\d+\s*\|\s*Highlight\s+Continued\s*\n', '\n', raw_text)

    # Now parse quotes (only matches "Highlight", not "Highlight Continued" since we removed those)
    QUOTE_PATTERN = r"Page\s+(.*?)\s*\|\s*Highlight\s*\n(.*?)(?=\nPage\s+|\Z)"
    matches = re.findall(QUOTE_PATTERN, raw_text, re.DOTALL)

    quotes = []
    for page, text in matches:
        # Clean page number - extract just the number
        page_clean = page.strip()
        page_match = re.search(r'(\d+)', page_clean)
        page_number = page_match.group(1) if page_match else page_clean

        quotes.append({
            "page": page_number,
            "text": clean_quote_text(text),
        })
    return quotes


# --------------------------
# File Generation Helpers
# --------------------------

def write_quote_file(quote, metadata):
    slug = slugify(quote["text"][:80])
    filename = f"{slug}.md"

    content = f"""---
note-type: quote
source: "[[{metadata['source_slug']}]]"
author: "[[{metadata['author_slug']}]]"
page: "{quote['page']}"
---

> {quote['text']}
"""

    with open(filename, "w") as f:
        f.write(content)


def write_author_note(metadata):
    filename = f"{metadata['author_slug']}.md"
    content = f"""---
note-type: author
---

A short bio can go here.
"""
    with open(filename, "w") as f:
        f.write(content)


def write_source_note(metadata):
    filename = f"{metadata['source_slug']}.md"

    # Format YAML tag block
    tag_block = ""
    if metadata["tags"]:
        tag_block = "tags:\n" + "\n".join(f"  - {t}" for t in metadata["tags"])

    # Quote citation safely
    citation = metadata["citation"]
    if citation:
        citation = f"\"{citation}\""

    link = metadata["link"]
    if link:
        link = f"\"{link}\""

    content = f"""---
note-type: source
{tag_block}
author: "[[{metadata['author_slug']}]]"
year: {metadata['year']}
publisher: {metadata['publisher']}
format: {metadata['format']}
link: {link}
citation: {citation}
---

# {metadata['title']}

Summary goes here.
"""

    with open(filename, "w") as f:
        f.write(content)


# --------------------------
# Test Mode Data
# --------------------------

TEST_QUOTES = """
Page xii | Highlight
liberation of human attention may be the defining moral and political struggle of our time. Its
success is prerequisite for the success of virtually all other struggles.

Page 88 | Highlight
people were computers, however, the appropriate description of the digital attention economy's
incursions upon their processing capacities would be that of the distributed denial-of-service, or
13
Page 88 | Highlight Continued
DDoS, attack. In a DDoS attack, the attacker controls many computers and uses them to send
many repeated requests to the target computer, effectively overwhelming its capacity to
communicate with any other computer.

Page xii | Highlight
We therefore have an obligation to rewire this system of intelligent, adversarial persuasion
before it rewires us.
"""

TEST_METADATA = {
    "title": "Stand out of our Light",
    "author": "James Williams",
    "year": "2018",
    "publisher": "Cambridge University Press",
    "link": "https://doi.org/10.1017/9781108453004",
    "citation": "Williams, J. (2018). Stand Out of Our Light: Freedom and Resistance in the Attention Economy.",
    "tags": ["attention", "ethics", "politics", "liberation"],
    "format": "book"
}


# --------------------------
# Main Program
# --------------------------

def main():

    # --- Detect Test Mode ---
    test_mode = False
    if len(sys.argv) > 1 and sys.argv[1] in ("--test", "-t"):
        test_mode = True

    # -----------------------------------------
    # 1. Collect Highlights
    # -----------------------------------------
    if test_mode:
        print("Running in TEST MODE...")
        raw_text = TEST_QUOTES
    else:
        print("Paste your Kindle highlights below.")
        print("Press Return, then Ctrl-D when done.\n")

        raw_text = ""
        try:
            while True:
                line = input()
                raw_text += line + "\n"
        except EOFError:
            pass

    quotes = parse_quotes(raw_text)
    print(f"\nParsed {len(quotes)} quotes.\n")

    # -----------------------------------------
    # 2. Collect Metadata
    # -----------------------------------------
    if test_mode:
        metadata = TEST_METADATA.copy()
        print("Using test metadata…")
    else:
        print("Enter source metadata:\n")

        metadata = {
            "title": input("Source title: ").strip(),
            "author": input("Author: ").strip(),
            "year": input("Year: ").strip(),
            "publisher": input("Publisher: ").strip(),
            "link": input("Link: ").strip(),
            "citation": input("Citation (will be quoted safely): ").strip(),
            "tags": [],
            "format": "book"
        }

        tags_raw = input("Tags (comma separated): ").strip()
        metadata["tags"] = [t.strip() for t in tags_raw.split(",")] if tags_raw else []

    # --- Create Slugs for Linking ---
    metadata["author_slug"] = slugify(metadata["author"])
    metadata["source_slug"] = slugify(metadata["title"])

    # -----------------------------------------
    # 3. Create Output Directory
    # -----------------------------------------
    output_dir = Path("../../scribsidian_outputs").resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    os.chdir(output_dir)

    # -----------------------------------------
    # 4. Write Notes
    # -----------------------------------------
    write_author_note(metadata)
    write_source_note(metadata)

    for q in quotes:
        write_quote_file(q, metadata)

    print(f"\nDone! Notes written to: {output_dir.resolve()}\n")


# --------------------------
# Run
# --------------------------

if __name__ == "__main__":
    main()
