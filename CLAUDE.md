# CLAUDE.md - Scribsidian Project Guide

## Project Overview

**Scribsidian** is a tool for converting Kindle highlights into Obsidian-compatible markdown notes with rich metadata and bi-directional linking. The project provides two implementations:

1. **Python CLI Tool** (`scribsidian.py`) - Command-line interface for batch processing
2. **React Web App** (`kindle-to-obsidian.tsx`) - Interactive web interface with AI-powered features

### Purpose

Transform Kindle highlights into a connected knowledge graph by:
- Parsing Kindle's "Page X | Highlight" format
- Creating structured notes with YAML frontmatter
- Establishing relationships between quotes, sources, and authors
- Enabling tag-based organization and discovery
- Supporting both manual and AI-assisted metadata extraction

## Repository Structure

```
scribsidian/
├── scribsidian.py           # Python CLI tool
├── kindle-to-obsidian.tsx   # React web application
├── output/                  # Legacy output directory (deprecated)
├── .git/                    # Git repository
├── .gitattributes          # Git configuration
└── CLAUDE.md               # This file

Outside repository:
../../scribsidian_outputs/   # Generated markdown notes (default output location)
```

### Output Directory

**Default location**: `../../scribsidian_outputs/` (relative to the repository root, resolves to outside the repository)

The output directory contains generated markdown files organized into three types:
- **Quote notes**: Individual highlights with metadata (page, source, author, tags)
- **Source notes**: Bibliographic information with summaries and topic tags
- **Author notes**: Placeholder files for author bios

**Note**: The output directory is created outside the repository to avoid cluttering the git history with generated content.

## Python CLI Tool (`scribsidian.py`)

### Architecture

**Core Functions:**
- `slugify()` - Convert text to URL-friendly slugs (max 60 chars)
- `clean_text()` - Collapse PDF line breaks and normalize whitespace
- `parse_quotes()` - Extract quotes using regex pattern matching
- `write_quote_file()` - Generate quote note with frontmatter
- `write_author_note()` - Generate author placeholder note
- `write_source_note()` - Generate source metadata note

### Workflow

1. **Input Collection**: Accept Kindle highlights via stdin (or use test mode with `--test`)
2. **Quote Parsing**: Use regex pattern to extract quotes (handles both "Highlight" and "Highlight Continued")
3. **Metadata Collection**: Prompt for title, author, year, publisher, link, citation, tags
4. **Slug Generation**: Create link-safe filenames from author and title
5. **Output Generation**: Write three types of notes to `../../scribsidian_outputs/` directory

### Note Structure

**Quote Note:**
```yaml
---
note-type: quote
source: "[[source-slug]]"
author: "[[author-slug]]"
page: X
---

> Quote text here
```

**Source Note:**
```yaml
---
note-type: source
tags:
  - tag1
  - tag2
author: "[[author-slug]]"
year: YYYY
publisher: Publisher Name
format: book
link: "URL"
citation: "Full citation"
---

# Title

Summary goes here.
```

**Author Note:**
```yaml
---
note-type: author
---

A short bio can go here.
```

### Usage

```bash
# Interactive mode
python scribsidian.py

# Test mode (uses built-in test data)
python scribsidian.py --test
# or
python scribsidian.py -t
```

### Test Mode

Test mode uses sample data from "Stand Out of Our Light" by James Williams, including:
- Two sample quotes (page xii highlights)
- Complete metadata with tags: attention, ethics, politics, liberation
- DOI link and full citation

## React Web App (`kindle-to-obsidian.tsx`)

### Architecture

A multi-step wizard interface built with React, Lucide icons, and Tailwind CSS.

**Key Components:**
- Step-based navigation (5 steps: Quotes → Source → Review → Tags → Download)
- AI integration via Claude API (claude-sonnet-4-20250514)
- Multiple export formats (individual markdown, CSV)
- Test data loader for demos

### Steps

1. **Quotes Input**: Paste Kindle highlights, auto-detect quote count
2. **Source Info**: Choose between AI parsing or manual entry
3. **Review**: Edit parsed metadata, generate AI summary
4. **Tags & Processing**: Add tags, choose processing mode
5. **Download**: View, copy, or export notes

### Processing Modes

**Quick Mode:**
- Fast processing (~5 seconds)
- No per-quote tags
- Simple quote titles (first 50 chars + "...")
- Best for large collections (50+ quotes)
- Minimal AI API calls

**Full Mode:**
- Rich metadata (~10-60 seconds)
- Custom tags for each quote (4-6 tags)
- AI-generated quote titles
- Best for focused reading (<50 quotes)
- Multiple AI API calls for analysis

### AI Features

1. **Citation Parsing**: Extract bibliographic info from citations, DOIs, or URLs
2. **Summary Generation**: Create 2-3 sentence summaries with web search
3. **Tag Generation**: Generate 5-8 topical tags based on title/author/summary
4. **Quote Analysis**: Batch process quotes for titles and tags (Full Mode only)

### Export Formats

**Markdown Files:**
- Individual .md files with proper frontmatter
- Source note: `{simplified-title} ({Author}, {year}).md`
- Author note: `{Author Full Name}.md`
- Quote notes: `{quote-title} ({Author}, {year}).md`

**CSV Export:**
- All notes in single CSV file
- Headers: filename, title, source, author, year, publisher, format, page, note-type, tags, body
- Proper escaping for commas, quotes, newlines

### Naming Conventions

**Title Simplification:**
- Remove subtitles after ":" (e.g., "Stand Out of Our Light: Freedom and..." → "Stand Out of Our Light")
- Remove special characters: `:`, `/`, `\`

**Tag Cleaning:**
- Remove prefixes: `#`, `topics/`
- Use single words or hyphenated phrases: `attention-economy`, `digital-ethics`

### API Integration

Uses Anthropic Claude API for all AI features:
```javascript
fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000-8000,
    messages: [{ role: 'user', content: prompt }],
    tools: [{ type: "web_search_20250305", name: "web_search" }] // Optional
  })
})
```

## Development Workflows

### Adding New Features

**Python CLI:**
1. Test changes with `--test` flag first
2. Ensure backward compatibility with existing output format
3. Update test data if needed
4. Maintain clean separation between parsing, metadata, and file generation

**React Web App:**
1. Use test data loader button for rapid iteration
2. Maintain step-based flow (avoid breaking navigation)
3. Keep AI calls asynchronous with proper loading states
4. Test both Quick and Full processing modes
5. Ensure export formats remain compatible with Obsidian

### Testing Strategy

**Python:**
- Use `--test` flag for automated testing
- Verify output files in `../../scribsidian_outputs/` directory
- Check slug generation for edge cases (special chars, long titles)
- Test YAML frontmatter formatting

**React:**
- Click "Load Test Data" for instant demo
- Test all 5 steps in sequence
- Verify CSV export format
- Check markdown file structure
- Test tag cleaning (remove prefixes)

### Git Workflow

Current branch: `claude/claude-md-miwbufj4ruqwjoj3-01UjNHjixLiKHwCwdPMBZRYH`

**Commit Standards:**
- Use descriptive commit messages
- Group related changes together
- Test before committing

**Branch Conventions:**
- Feature branches start with `claude/`
- Include session ID in branch name

## Key Conventions

### Code Style

**Python:**
- Follow PEP 8 conventions
- Use descriptive function names (verb_noun pattern)
- Maximum line length: ~80 chars (flexible)
- F-strings for string formatting
- Type hints not required but acceptable

**TypeScript/React:**
- Functional components with hooks
- camelCase for variables and functions
- PascalCase for components
- Use arrow functions for event handlers
- Tailwind CSS for styling (utility-first)

### Naming Patterns

**Files:**
- Snake_case for Python: `scribsidian.py`
- Kebab-case for config: `kindle-to-obsidian.tsx`
- Generated notes: `{content-slug}.md`

**Slugs:**
- Lowercase, dash-separated
- Remove special characters except hyphens
- Max 60 characters (truncate if needed)
- Strip trailing dashes

**Variables:**
- Descriptive names over brevity
- Boolean prefixes: `is`, `has`, `should`, `use`
- Arrays: plural nouns (`quotes`, `tags`)
- Objects: singular nouns (`metadata`, `parsedSource`)

### YAML Frontmatter

**Required Fields:**
- `note-type`: quote | source | author

**Quote Fields:**
- `source`: WikiLink to source note
- `author`: WikiLink to author note
- `tags`: Array of strings (no prefixes)
- `citation`: Full citation string
- `page`: Page number or range
- `link`: Optional URL/DOI

**Source Fields:**
- `tags`: Array of topic tags
- `author`: Full name (not WikiLink)
- `year`: Publication year
- `publisher`: Publisher name
- `format`: book | article | essay | paper
- `link`: Optional URL/DOI
- `citation`: Full citation string

**Author Fields:**
- Minimal frontmatter (just note-type)
- Body contains bio

### Tag Philosophy

**Source-Level Tags:**
- 5-8 broad topical tags
- Academic/substantive terms
- Examples: `attention-economy`, `digital-ethics`, `political-theory`
- Avoid generic tags: `reading`, `book`, `literature`

**Quote-Level Tags (Full Mode):**
- 4-6 specific concept tags
- Granular themes within the quote
- Examples: `attention`, `freedom`, `mindfulness`, `technology-critique`

**Tag Format:**
- No prefixes: ~~`#attention`~~ → `attention`
- No hierarchies in tags: ~~`topics/ethics`~~ → `ethics`
- Single words or hyphenated phrases
- Lowercase

## Guidelines for AI Assistants

### When Working with This Codebase

**DO:**
- Read existing code before making changes
- Preserve the note structure and frontmatter format
- Test with the built-in test modes
- Maintain backward compatibility with Obsidian
- Keep both implementations in sync (Python and React)
- Use descriptive variable names
- Add comments for complex regex or parsing logic
- Validate YAML frontmatter syntax
- Clean user input (remove tag prefixes, special chars)

**DON'T:**
- Break WikiLink format: `[[slug]]` not `[slug]`
- Add prefixes to tags in YAML (no `#` or `topics/`)
- Change the note-type values (quote, source, author)
- Change the output directory without good reason
- Hardcode API keys or credentials
- Modify slug generation without testing edge cases
- Break the 5-step flow in React app
- Introduce dependencies without justification

### Common Tasks

**Adding a New Field to Notes:**
1. Update the relevant `write_*_note()` function in Python
2. Update the corresponding template string in React
3. Update this documentation
4. Test with both implementations

**Modifying Quote Parsing:**
1. Update `QUOTE_PATTERN` regex in Python
2. Update `parseKindleQuotes()` in React
3. Test with various highlight formats
4. Consider backward compatibility

**Changing AI Prompts:**
1. Locate the API call in React
2. Modify the `content` field in the message
3. Test with diverse inputs
4. Monitor token usage and response quality

**Adding Export Formats:**
1. Create new generator function (e.g., `generateJSON()`)
2. Add UI button/option in React
3. Implement in Python CLI if applicable
4. Document in this file

### Understanding the Data Flow

**Python CLI:**
```
stdin → parse_quotes() → metadata input → slug generation → write_*_note() → ../../scribsidian_outputs/
```

**React Web App:**
```
Paste quotes → Parse quotes → AI/Manual source entry → Review → Add tags → Generate notes → Export
```

### API Usage Patterns

**Claude API Calls in React:**
1. Citation parsing: ~1000 tokens, no web search
2. Summary generation: ~1000 tokens, WITH web search
3. Tag generation: ~1000 tokens, WITH web search
4. Quote analysis (Full Mode): ~8000 tokens, no web search

**Rate Limiting:**
- No built-in rate limiting
- Full Mode can make multiple API calls quickly
- Consider adding delays for large quote collections

### Debugging Tips

**Python:**
- Use `--test` flag to isolate quote parsing
- Check `../../scribsidian_outputs/` directory for generated files
- Print intermediate values in `main()`
- Validate regex patterns at regex101.com

**React:**
- Use browser console for error messages
- "Load Test Data" button for quick testing
- Check Network tab for API call failures
- Use React DevTools to inspect state
- Verify CSV escaping with special characters

### Security Considerations

**API Keys:**
- Never commit API keys to git
- Users must provide their own Anthropic API key
- Frontend code exposes API calls (client-side risk)

**Input Validation:**
- Quote parsing is regex-based (safe)
- Metadata is user-provided (sanitize for YAML)
- File writes use cleaned slugs (prevent path traversal)

**Output Safety:**
- YAML values are quoted when needed
- CSV escaping prevents injection
- No code execution in generated notes

## Future Enhancements

### Potential Features

**Python CLI:**
- Configuration file for default metadata
- Batch processing multiple sources
- Import from other highlight formats (PDF, etc.)
- SQLite database for note tracking
- Better error handling and validation

**React Web App:**
- Backend API for secure Claude integration
- User accounts and saved conversions
- Direct Obsidian vault integration
- Support for PDF highlights
- Batch processing multiple books
- Tag suggestions based on existing vault
- Preview mode for generated notes
- Undo/redo functionality
- Dark mode toggle

**Both:**
- Support for chapter/location metadata
- Image/diagram extraction
- Annotation notes (not just highlights)
- Export to other note-taking apps (Notion, Roam)
- Automatic deduplication of quotes
- Smart quote merging (combine adjacent highlights)

## Troubleshooting

### Common Issues

**Python:**
- **Empty output**: Check input format matches "Page X | Highlight"
- **Broken slugs**: Special characters in title/author
- **YAML errors**: Unquoted strings with colons or quotes
- **Missing output**: Check current directory has write permissions

**React:**
- **API errors**: Check API key, network, and quotas
- **Parse failures**: Try manual entry mode
- **Tag prefixes**: Clean tags before saving
- **Download fails**: Use copy/paste method instead
- **CSV format issues**: Check for unescaped quotes

### Error Messages

**"Could not parse source"**: AI parsing failed, use manual entry
**"Error generating notes"**: API timeout or invalid response, try Quick Mode
**"Copy failed"**: Browser clipboard permissions, try manual copy

## Version History

- **Current**: Initial implementation with Python CLI and React web app
- Two processing modes (Quick/Full)
- CSV and markdown export
- AI-powered metadata extraction

## Contributing

When contributing to this project:

1. Understand both implementations (Python and React)
2. Test changes with test modes
3. Update this CLAUDE.md file
4. Maintain backward compatibility
5. Follow existing code style
6. Document new features
7. Consider Obsidian compatibility

## Resources

**Dependencies:**
- Python: Standard library only (re, os, sys, unicodedata, pathlib)
- React: React 18+, Lucide icons, Tailwind CSS
- API: Anthropic Claude (claude-sonnet-4-20250514)

**External Links:**
- [Obsidian](https://obsidian.md/) - Target note-taking application
- [Anthropic API](https://docs.anthropic.com/) - AI integration
- [Kindle Highlights](https://read.amazon.com/notebook) - Source of highlights

**Related Formats:**
- Markdown: CommonMark spec
- YAML: YAML 1.2 spec
- CSV: RFC 4180 standard

---

**Last Updated**: 2025-12-07
**Project Maintainer**: User workspace
**AI Assistant**: Claude (Anthropic)
