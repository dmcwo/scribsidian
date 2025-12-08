#!/usr/bin/env python3

import os
import re
import sys
import unicodedata
from pathlib import Path
from collections import Counter, defaultdict

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
# Noun Phrase Extraction & Tag Suggestion Engine
# --------------------------

STOPWORDS = {
    "the", "and", "of", "to", "in", "for", "on", "at", "a", "an", "is", "are",
    "it", "its", "this", "that", "as", "with", "be", "by", "from", "we", "you",
    "our", "their", "your", "but", "or", "into", "over", "may", "been", "were",
    "however", "than"
}

def extract_noun_phrases(text):
    """
    Heuristic extractor for multi-word noun/adjective phrases.
    Returns phrases in kebab-case (e.g., "human-attention").
    """
    # Lowercase and keep alphabetic tokens and hyphens/apostrophes
    words = re.findall(r"[a-zA-Z\-']+", text.lower())

    phrases = []
    current = []

    for w in words:
        if w in STOPWORDS:
            if len(current) > 0:
                phrases.append(" ".join(current))
                current = []
        elif re.match(r"[a-z]+", w):
            current.append(w)
        else:
            if len(current) > 0:
                phrases.append(" ".join(current))
                current = []

    if current:
        phrases.append(" ".join(current))

    # Normalize multi-word to kebab-case and filter short fragments
    cleaned = []
    for p in phrases:
        p = p.strip()
        if len(p) > 1:
            cleaned.append(p.replace(" ", "-"))

    return cleaned


def suggest_tags_for_all_quotes(quotes, max_suggestions=8):
    """
    Build relevance-weighted suggestions for each quote by combining:
    - global phrase frequency across all quotes (global weight)
    - a local relevance boost for phrases that appear in the specific quote
    Results stored in quote["suggested_tags"] as a list of kebab-case tags.
    """
    # Collect per-quote phrases and global counts
    global_phrases = Counter()
    per_quote_phrases = []

    for q in quotes:
        np_list = extract_noun_phrases(q["text"])
        per_quote_phrases.append(np_list)
        global_phrases.update(np_list)

    for i, q in enumerate(quotes):
        local = per_quote_phrases[i]
        scores = defaultdict(int)

        # global weight
        for phrase, freq in global_phrases.items():
            scores[phrase] += freq

        # local relevance boost
        for phrase in local:
            scores[phrase] += 5

        # sort by score descending, then phrase alphabetical for determinism
        sorted_tags = sorted(scores.items(), key=lambda x: (-x[1], x[0]))
        top_tags = [tag for tag, score in sorted_tags[:max_suggestions]]

        q["suggested_tags"] = top_tags


# --------------------------
# Quote Parsing (your improved version)
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
        # Clean page number - extract just the number if present
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

    # YAML list for tags (always include tags: block; empty list if no tags)
    tag_block = "tags:\n" + "\n".join(f"  - {t}" for t in quote.get("tags", []))
    if not quote.get("tags"):
        # ensure there's a placeholder empty item so YAML keeps the field visible
        tag_block = "tags:\n  -\n"

    content = f"""---
note-type: quote
source: "[[{metadata['source_slug']}]]"
author: "[[{metadata['author_slug']}]]"
{tag_block}
page: {quote['page']}
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

def tag_quotes_interactively(quotes):
    """Ask user for tags for each quote. Normalizes tag formatting and shows suggestions."""
    print("\nTagging quotes…\n")

    for i, quote in enumerate(quotes, start=1):
        print(f"[{i}/{len(quotes)}]")
        print("-" * 40)
        print(quote["text"])
        print("-" * 40)

        # show suggested tags if present
        suggested = quote.get("suggested_tags", [])
        if suggested:
            print("Suggested tags:")
            for tag in suggested:
                print(f"  - {tag}")

        tag_input = input("\nEnter tags (comma separated, Enter to skip): ").strip()

        if not tag_input:
            # User skipped — but include empty list
            quote["tags"] = []
            print("Tags skipped.\n")
            continue

        # Normalize tags
        tags = []
        for t in tag_input.split(","):
            cleaned = t.strip().lower().replace(" ", "-")
            if cleaned:
                tags.append(cleaned)

        quote["tags"] = tags
        print(f"Saved tags: {tags}\n")

    return quotes


# --------------------------
# Main Program
# --------------------------

def main_simple(test_mode=False):
    """
    Original simple CLI mode.
    Preserved with --simple flag for users who prefer the traditional interface.
    """

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
    # 3. Suggest tags for quotes (global + local)
    # -----------------------------------------
    suggest_tags_for_all_quotes(quotes)

    # -----------------------------------------
    # 4. Tag quotes interactively
    # -----------------------------------------
    if not test_mode:
        quotes = tag_quotes_interactively(quotes)
    else:
        # In test mode, assign ALL suggested tags automatically
        for q in quotes:
            q["tags"] = q.get("suggested_tags", [])
        print("\nAssigned suggested tags automatically (test mode).\n")

    # -----------------------------------------
    # 5. Create Output Directory
    # -----------------------------------------
    output_dir = Path("../../scribsidian_outputs").resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    os.chdir(output_dir)

    # -----------------------------------------
    # 6. Write Notes
    # -----------------------------------------
    write_author_note(metadata)
    write_source_note(metadata)

    for q in quotes:
        write_quote_file(q, metadata)

    print(f"\nDone! Notes written to: {output_dir.resolve()}\n")


# --------------------------
# Run
# --------------------------

def main():
    """
    Entry point - parses flags and launches appropriate mode.

    Usage:
        python scribsidian.py              # Launch TUI (default)
        python scribsidian.py --simple     # Simple CLI mode
        python scribsidian.py --test       # TUI with test data
        python scribsidian.py --simple -t  # Simple CLI with test data
    """
    import argparse

    parser = argparse.ArgumentParser(
        description="Scribsidian - Convert Kindle highlights to Obsidian notes"
    )
    parser.add_argument(
        "--simple",
        action="store_true",
        help="Use simple CLI mode (no TUI)"
    )
    parser.add_argument(
        "-t", "--test",
        action="store_true",
        help="Load test data"
    )

    args = parser.parse_args()

    if args.simple:
        # Run original simple CLI mode
        main_simple(test_mode=args.test)
    else:
        # Run TUI mode (default)
        try:
            from scribsidian_tui import run_tui
            run_tui(test_mode=args.test)
        except ImportError as e:
            print("\n❌ Error: Textual library not found!")
            print("Please install dependencies:")
            print("  pip install -r requirements.txt")
            print("\nOr use simple mode:")
            print("  python scribsidian.py --simple")
            sys.exit(1)


if __name__ == "__main__":
    main()
