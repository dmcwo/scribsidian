# CLAUDE.md - Scribsidian Project Guide

## Project Overview

**Scribsidian** is a tool for converting Kindle highlights into Obsidian-compatible markdown notes with rich metadata and bi-directional linking. The project provides three implementations:

1. **Python TUI** (`scribsidian.py` + `scribsidian_tui.py`) - Terminal User Interface with interactive screens (default)
2. **Python Simple CLI** (`scribsidian.py --simple`) - Traditional command-line interface for batch processing
3. **React Web App** (`kindle-to-obsidian.tsx`) - Interactive web interface with AI-powered features

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
├── scribsidian.py           # Python CLI entry point & core functions
├── scribsidian_tui.py       # Terminal User Interface (Textual)
├── kindle-to-obsidian.tsx   # React web application
├── requirements.txt         # Python dependencies (textual)
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
- `extract_noun_phrases()` - Heuristic extraction of multi-word noun/adjective phrases
- `suggest_tags_for_all_quotes()` - Generate tag suggestions using global frequency + local relevance
- `tag_quotes_interactively()` - Interactive tagging with AI-suggested tags displayed
- `write_quote_file()` - Generate quote note with frontmatter
- `write_author_note()` - Generate author placeholder note
- `write_source_note()` - Generate source metadata note

### Workflow

1. **Input Collection**: Accept Kindle highlights via stdin (or use test mode with `--test`)
2. **Quote Parsing**: Use regex pattern to extract quotes (handles both "Highlight" and "Highlight Continued")
3. **Metadata Collection**: Prompt for title, author, year, publisher, link, citation, tags
4. **Slug Generation**: Create link-safe filenames from author and title
5. **Tag Suggestion**: Analyze all quotes to suggest relevant tags using noun phrase extraction
6. **Interactive Tagging**: Display suggested tags and prompt user to tag each quote
7. **Output Generation**: Write three types of notes to `../../scribsidian_outputs/` directory

### Note Structure

**Quote Note:**
```yaml
---
note-type: quote
source: "[[source-slug]]"
author: "[[author-slug]]"
tags:
  - tag1
  - tag2
page: X
---

> Quote text here
```

**Note**: Quote-level tags are supported in the Python CLI (with AI suggestions) but not yet implemented in the React web app.

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
# TUI mode (default) - Interactive terminal UI
python scribsidian.py

# TUI with test data
python scribsidian.py --test

# Simple CLI mode (original interface)
python scribsidian.py --simple

# Simple CLI with test data
python scribsidian.py --simple --test
```

### Tag Suggestion Engine

The Python CLI includes an intelligent tag suggestion system that analyzes quote content to recommend relevant tags:

**Algorithm:**
- **Noun Phrase Extraction**: Identifies multi-word concepts using a stopword-filtered heuristic
- **Global Frequency**: Counts phrase occurrences across all quotes in the collection
- **Local Relevance Boost**: Adds weight (+5) to phrases that appear in the specific quote
- **Scoring**: Combines global frequency with local relevance to rank suggestions
- **Output Format**: Returns up to 8 kebab-case tags per quote (e.g., "human-attention", "digital-ethics")

**Stopwords**: Common words (the, and, of, to, in, etc.) are filtered out to focus on meaningful concepts.

**Interactive Workflow:**
1. After parsing quotes, the system analyzes all quotes to build a corpus
2. For each quote, it displays the quote text and suggested tags
3. User can accept suggestions, modify them, or skip tagging
4. Tags are normalized to lowercase kebab-case format
5. Empty tag lists are preserved in YAML frontmatter

**Test Mode Behavior:**
- Automatically assigns all suggested tags without user interaction
- Useful for rapid testing and iteration

### Test Mode

Test mode uses sample data from "Stand Out of Our Light" by James Williams, including:
- Three sample quotes (pages xii and 88)
- One multi-page quote with "Highlight Continued" handling
- Complete metadata with tags: attention, ethics, politics, liberation
- DOI link and full citation
- Automatic tag suggestion and assignment

## Python TUI (`scribsidian_tui.py`)

### Overview

The Terminal User Interface (TUI) provides a modern, interactive experience for converting Kindle highlights to Obsidian notes. Built with [Textual](https://textual.textualize.io/), it offers a visual, app-like interface in the terminal with panels, buttons, checkboxes, and keyboard shortcuts.

**Why TUI?**
- **Visual feedback**: See quote counts, progress, and previews in real-time
- **Easier data entry**: Form-based metadata input with validation
- **Interactive tagging**: Checkboxes for suggested tags with per-quote navigation
- **Better UX**: Navigate between steps, go back to edit, preview before generating
- **Keyboard shortcuts**: Efficient navigation with arrow keys, tab, enter, and hotkeys

### Installation

The TUI requires the `textual` library:

```bash
pip install -r requirements.txt
```

If textual is not installed, the tool falls back gracefully with a helpful error message suggesting either installation or using `--simple` mode.

### Architecture

The TUI is organized into 6 screens with a step-based wizard flow:

**Screens:**
1. **WelcomeScreen** - Introduction with Start/Load Test Data/Quit buttons
2. **QuoteInputScreen** - Large text area for pasting Kindle highlights with live quote count
3. **MetadataScreen** - Form inputs for title, author, year, publisher, link, citation, tags
4. **TagQuotesScreen** - Per-quote tagging interface with checkboxes for suggested tags
5. **ReviewScreen** - Summary of all data with statistics before file generation
6. **CompletedScreen** - Success message with output path and Done button

**Components:**
- `ScribsidianApp` - Main application class that manages screen stack
- Each screen extends `textual.screen.Screen` with custom CSS styling
- Reuses core functions from `scribsidian.py`: `parse_quotes()`, `suggest_tags_for_all_quotes()`, `write_*_file()`

### Screen Flow

```
Welcome
   ↓ [Start] or [Load Test Data]
Quote Input (paste highlights, shows count)
   ↓ [Continue →]
Metadata (form for source info)
   ↓ [Continue →] (auto-generates tag suggestions)
Tag Quotes (checkbox selection, custom tags, navigate with n/p)
   ↓ [Continue →] or [Skip All →]
Review (summary stats, file list)
   ↓ [Generate Files ✨]
Completed (success message)
   ↓ [Done]
Exit
```

### Key Features

**1. Quote Input Screen**
- Large text area with syntax highlighting
- Real-time quote count updates as you type
- Auto-loads test data in test mode
- Back button to return to welcome

**2. Metadata Screen**
- Labeled form inputs for all metadata fields
- Required field validation (title, author)
- Auto-fills with test data in test mode
- Scrollable container for long forms

**3. Tag Quotes Screen** (Interactive Tagging)
- Shows one quote at a time with page number
- Displays suggested tags as checkboxes
- Custom tag input for additional tags
- Keyboard shortcuts:
  - `n` - Next quote
  - `p` - Previous quote
  - `Space` - Toggle checkbox
  - `Tab` - Navigate between inputs
  - `Esc` - Go back
- Progress indicator: "Tag Quotes (3/15)"
- "Skip All" button to bypass tagging

**4. Review Screen**
- Source metadata summary
- Quote statistics (total, tagged, untagged)
- List of files to be generated
- Output directory path
- Final chance to go back and edit

**5. Completed Screen**
- Success message with file count
- Full output directory path
- Clean exit

### Keyboard Shortcuts

**Global:**
- `Esc` - Go back to previous screen
- `Ctrl+C` - Quit application

**Tag Quotes Screen:**
- `n` - Next quote (also saves current tags)
- `p` - Previous quote (also saves current tags)
- `Space` - Toggle checkbox selection
- `Tab` / `Shift+Tab` - Navigate between checkboxes and inputs

**All Screens:**
- `Tab` - Navigate between interactive elements
- `Enter` - Activate buttons
- `Arrow keys` - Navigate in scrollable areas

### Styling

The TUI uses Textual's CSS-like styling system:

**Design Principles:**
- Border boxes for visual hierarchy
- Primary color accents for headers and important elements
- Consistent padding and margins
- Scrollable containers for long content
- Button variants: primary (green), default (blue), error (red), success (green)

**Color Scheme:**
- Uses terminal's default theme
- `$accent` - Highlighted text (titles, labels)
- `$primary` - Borders and primary buttons
- `$success` - Success messages and final button
- `$text-muted` - Secondary text (e.g., page numbers)

### Integration with Core Functions

The TUI imports and reuses all core functionality from `scribsidian.py`:

```python
from scribsidian import (
    parse_quotes,              # Quote parsing with regex
    suggest_tags_for_all_quotes, # Tag suggestion engine
    write_quote_file,          # File generation
    write_author_note,
    write_source_note,
    slugify,                   # Slug generation
    TEST_QUOTES,               # Test data
    TEST_METADATA
)
```

This ensures consistency between TUI and simple CLI modes - both generate identical output files.

### Test Mode

Launch TUI with test data pre-loaded:

```bash
python scribsidian.py --test
```

This skips the welcome screen and loads directly into Quote Input Screen with test highlights from "Stand Out of Our Light" by James Williams.

### Error Handling

- **Missing textual**: Graceful fallback with installation instructions
- **Empty quotes**: Warning notification if user tries to continue without pasting highlights
- **Required fields**: Validation for title and author in metadata form
- **File generation errors**: Exception handling with error notifications

### Development Notes

**Adding New Screens:**
1. Create screen class extending `Screen`
2. Define CSS in class `CSS` attribute
3. Implement `compose()` for layout
4. Add button handlers in `on_button_pressed()`
5. Update screen navigation to include new screen

**Modifying Layout:**
- Edit CSS string in screen class
- Use Textual containers: `Container`, `Vertical`, `Horizontal`, `ScrollableContainer`
- Widgets available: `Button`, `Input`, `TextArea`, `Checkbox`, `Label`, `Static`, `DataTable`

**Hot Reload:**
Textual supports hot reload during development:
```bash
textual run --dev scribsidian_tui.py
```

### Comparison with Simple CLI

| Feature | TUI Mode | Simple CLI Mode |
|---------|----------|----------------|
| Interface | Visual, multi-screen | Text prompts |
| Navigation | Buttons, back/forward | Linear, no back |
| Quote input | Text area with live count | stdin with Ctrl-D |
| Metadata | Form with labels | Sequential prompts |
| Tagging | Checkboxes, per-quote | Text input, per-quote |
| Preview | Review screen before generating | No preview |
| Dependencies | Requires `textual` | No dependencies |
| Use case | Interactive sessions | Scripting, automation |

**When to use Simple CLI:**
- Piping input from other commands
- Scripting and automation
- Headless environments
- Minimal dependencies desired
- Old terminals without full TUI support

**When to use TUI:**
- Interactive manual sessions
- First-time users
- Complex books with many quotes
- When you want to review before generating
- Modern terminals with full Unicode support

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

Current branch: `claude/claude-md-mixbebttrbna1srd-01J7xKtxz8x4xBFTnNDb55vb`

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
- Machine learning-based tag classification
- Integration with external tag vocabularies (e.g., Library of Congress Subject Headings)

**React Web App:**
- **Port tag suggestion engine from Python** (high priority for feature parity)
- **Per-quote tagging UI** (high priority for feature parity)
- Backend API for secure Claude integration
- User accounts and saved conversions
- Direct Obsidian vault integration
- Support for PDF highlights
- Batch processing multiple books
- Tag suggestions based on existing vault
- Preview mode for generated notes
- Undo/redo functionality
- Dark mode toggle
- Better "Highlight Continued" handling (match Python implementation)

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

### Current (December 2025)
- **Tag Suggestion Engine** (Python CLI only): Intelligent tag suggestions using noun phrase extraction
- **Improved Quote Parsing**: Better handling of "Highlight Continued" across pages
- **Interactive Tagging**: User-friendly workflow with suggested tags displayed
- Two processing modes (Quick/Full) in React app
- CSV and markdown export
- AI-powered metadata extraction

### Feature Parity Status

**Python TUI Features:**
- ✅ Quote parsing with "Highlight Continued" support
- ✅ Tag suggestion engine with noun phrase extraction
- ✅ Interactive per-quote tagging with checkboxes
- ✅ Source-level tags
- ✅ YAML frontmatter generation
- ✅ Test mode with pre-filled data
- ✅ Visual wizard interface with 6 screens
- ✅ Back navigation and review before generating
- ✅ Keyboard shortcuts and form validation

**Python Simple CLI Features:**
- ✅ Quote parsing with "Highlight Continued" support
- ✅ Tag suggestion engine with noun phrase extraction
- ✅ Interactive per-quote tagging (text-based)
- ✅ Source-level tags
- ✅ YAML frontmatter generation
- ✅ Test mode with automatic tag assignment
- ✅ No dependencies (stdlib only)

**React Web App Features:**
- ✅ Quote parsing (basic)
- ✅ AI citation parsing
- ✅ AI summary generation
- ✅ Source-level tag generation (AI)
- ✅ Quick/Full processing modes
- ✅ CSV export
- ✅ Test data loader
- ❌ Per-quote tagging (not yet implemented)
- ❌ Tag suggestion engine (not yet ported from Python)
- ❌ "Highlight Continued" preprocessing (simpler implementation)

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
- Python Core: Standard library only (re, os, sys, unicodedata, pathlib, argparse)
- Python TUI: textual>=0.47.0 (optional, falls back to simple mode if not installed)
- React: React 18+, Lucide icons, Tailwind CSS
- API: Anthropic Claude (claude-sonnet-4-20250514)

**External Links:**
- [Obsidian](https://obsidian.md/) - Target note-taking application
- [Anthropic API](https://docs.anthropic.com/) - AI integration
- [Textual](https://textual.textualize.io/) - TUI framework for Python
- [Kindle Highlights](https://read.amazon.com/notebook) - Source of highlights

**Related Formats:**
- Markdown: CommonMark spec
- YAML: YAML 1.2 spec
- CSV: RFC 4180 standard

---

**Last Updated**: 2025-12-08
**Project Maintainer**: User workspace
**AI Assistant**: Claude (Anthropic)

## Recent Changes (December 7-8, 2025)

### Terminal User Interface (December 8, 2025)
- **New TUI Implementation**: Built comprehensive terminal UI using Textual framework
- **6-Screen Wizard**: Welcome → Quote Input → Metadata → Tag Quotes → Review → Complete
- **Interactive Tagging**: Checkbox-based tag selection with keyboard navigation (n/p keys)
- **Visual Feedback**: Real-time quote counts, progress indicators, validation messages
- **Dual Mode Support**: Added `--simple` flag to preserve original CLI while making TUI default
- **Graceful Fallback**: Clear error message if textual not installed, suggesting simple mode
- **Test Mode**: `--test` flag now works in both TUI and simple modes
- **New Files**: `scribsidian_tui.py` (TUI implementation), `requirements.txt` (dependencies)
- **Code Reuse**: TUI imports and reuses all core functions from scribsidian.py
- **Enhanced UX**: Back navigation, review screen, keyboard shortcuts, form validation

### Tag Suggestion Engine (December 7, 2025)
- Added heuristic noun phrase extraction with stopword filtering
- Implemented relevance scoring combining global frequency and local context
- Created interactive tagging workflow with suggestions displayed
- Modified test mode to automatically assign suggested tags
- Added comprehensive tag normalization (lowercase, kebab-case)

### Quote Parsing Improvements (December 7, 2025)
- Enhanced "Highlight Continued" preprocessing to merge split quotes
- Improved page number extraction and cleaning
- Better handling of multi-page highlights

### Note Structure Updates (December 7, 2025)
- Quote notes now include `tags:` field in YAML frontmatter
- Empty tag lists preserved with placeholder syntax
- Consistent tag formatting across all note types
