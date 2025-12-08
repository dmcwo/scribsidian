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
# Quote Parsing
# --------------------------

QUOTE_PATTERN = r"Page\s+(.*?)\s*\|\s*Highlight\s*\n(.*?)\n(?=Page|\Z)"

def parse_quotes(raw_text):
    matches = re.findall(QUOTE_PATTERN, raw_text, re.DOTALL)
    quotes = []
    for page, text in matches:
        quotes.append({
            "page": page.strip(),
            "text": clean_text(text),
        })
    return quotes


# --------------------------
# Noun Phrase Extraction
# --------------------------

STOPWORDS = {
    "the", "and", "of", "to", "in", "for", "on", "at", "a", "an", "is", "are",
    "it", "its", "this", "that", "as", "with", "be", "by", "from", "we", "you",
    "our", "their", "your", "but", "or", "into", "over"
}

def extract_noun_phrases(text):
    """Heuristic multi-word noun/adjective phrase extractor."""
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

    # Normalize multi-word to kebab-case
    cleaned = []
    for p in phrases:
        p = p.strip()
        if len(p) > 1:
            cleaned.append(p.replace(" ", "-"))

    return cleaned


# --------------------------
# Tag Suggestion Engine
# --------------------------

def suggest_tags_for_all_quotes(quotes, max_suggestions=8):
    """Create relevance-weighted tag suggestions for each quote."""

    # Global noun phrase frequency
    global_phrases = Counter()
    per_quote_phrases = []

    for q in quotes:
        np = extract_noun_phrases(q["text"])
        per_quote_phrases.append(np)
        global_phrases.update(np)

    for i, q in enumerate(quotes):
        local = per_quote_phrases[i]

        scores = defaultdict(int)

        for phrase, freq in global_phrases.items():
            scores[phrase] += freq  # global weight

        for phrase in local:
            scores[phrase] += 5  # relevance boost

        sorted_tags = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        top_tags = [tag for tag, score in sorted_tags[:max_suggestions]]

        q["suggested_tags"] = top_tags


# --------------------------
# Interactive Tagging
# --------------------------

def tag_quotes_interactively(quotes):
    """Ask user for tags for each quote. Shows suggestions."""
    print("\nTagging quotes…\n")

    for i, quote in enumerate(quotes, start=1):
        print(f"[{i}/{len(quotes)}]")
        print("-" * 40)
        print(quote["text"])
        print("-" * 40)

        print("Suggested tags:")
        for tag in quote["suggested_tags"]:
            print(f"  - {tag}")

        tag_input = input("\nEnter tags (comma separated, Enter to skip): ").strip()

        if not tag_input:
            quote["tags"] = []  # include empty list
            print("Tags skipped.\n")
            continue

        tags = []
        for t in tag_input.split(","):
            cleaned = t.strip().lower().replace(" ", "-")
            if cleaned:
                tags.append(cleaned)

        quote["tags"] = tags
        print(f"Saved tags: {tags}\n")

    return quotes


# --------------------------
# File Generation Helpers
# --------------------------

def write_quote_file(quote, metadata):
    slug = slugify(quote["text"][:80])
    filename = f"{slug}.md"

    tag_block = "tags:\n" + "\n".join(f"  - {t}" for t in quote["tags"])

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

    tag_block = "tags:\n" + "\n".join(f"  - {t}" for t in metadata["tags"])

    citation = f"\"{metadata['citation']}\"" if metadata["citation"] else ""
    link = f"\"{metadata['link']}\"" if metadata["link"] else ""

    content = f"""---
note-type: source
{tag_block}
author: {metadata['author']}
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
    test_mode = len(sys.argv) > 1 and sys.argv[1] in ("--test", "-t")

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
    # 2. Metadata
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
            "citation": input("Citation (wrapped safely): ").strip(),
            "tags": [],
            "format": "book"
        }

        tags_raw = input("Tags (comma separated): ").strip()
        metadata["tags"] = [t.strip() for t in tags_raw.split(",")] if tags_raw else []

    metadata["author_slug"] = slugify(metadata["author"])
    metadata["source_slug"] = slugify(metadata["title"])

    # -----------------------------------------
    # 3. Generate Tag Suggestions
    # -----------------------------------------
    suggest_tags_for_all_quotes(quotes)

    # -----------------------------------------
    # 4. Interactive Tagging (or test auto-tag)
    # -----------------------------------------
    if test_mode:
        for q in quotes:
            q["tags"] = q["suggested_tags"]
        print("\nAssigned suggested tags automatically (test mode).\n")
    else:
        quotes = tag_quotes_interactively(quotes)

    # -----------------------------------------
    # 5. Write Files
    # -----------------------------------------
    output_dir = Path("output")
    output_dir.mkdir(exist_ok=True)
    os.chdir(output_dir)

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
