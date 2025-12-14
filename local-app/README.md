# Kindle to Obsidian - Local App

A local web application for converting Kindle highlights into Obsidian-compatible markdown notes with rich metadata and AI-powered features.

## Features

- **AI-Powered Parsing**: Extract bibliographic information from citations, DOIs, or URLs
- **Smart Tagging**: Generate topical tags using Claude AI with web search
- **Summary Generation**: Create concise summaries of books and articles
- **Two Processing Modes**:
  - **Quick Mode**: Fast processing with minimal AI calls (best for 50+ quotes)
  - **Full Mode**: Rich metadata with custom tags and titles for each quote (best for <50 quotes)
- **Multiple Export Formats**: Individual markdown files or CSV
- **Direct Downloads**: Download all markdown files directly to your computer

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- An Anthropic API key ([get one here](https://console.anthropic.com/))

## Setup Instructions

### 1. Install Dependencies

```bash
cd local-app
npm install
```

### 2. Configure API Key

Create a `.env` file in the `local-app` directory:

```bash
cp .env.example .env
```

Then edit `.env` and add your Anthropic API key:

```bash
VITE_ANTHROPIC_API_KEY=sk-ant-your-actual-key-here
```

**⚠️ IMPORTANT**: Never commit your `.env` file to git! It's already in `.gitignore`.

### 3. Run the Development Server

```bash
npm run dev
```

The app will open at `http://localhost:5173`

## Usage

### Step 1: Paste Kindle Highlights

1. Go to [Kindle Highlights](https://read.amazon.com/notebook)
2. Select a book and copy the highlights
3. Paste them into the text area
4. The app will automatically detect the number of quotes

**Expected Format:**
```
Page xii | Highlight
Your highlighted text here

Page 15 | Highlight
Another highlighted text
```

### Step 2: Add Source Information

Choose between:
- **AI Parse**: Paste a citation, DOI, or URL and let Claude extract the metadata
- **Manual Entry**: Fill in the fields yourself

### Step 3: Review and Edit

Review the extracted metadata and make any necessary edits. You can also:
- Generate an AI summary of the book
- Preview how the title will be simplified (subtitles are removed)

### Step 4: Tags & Processing

1. **Generate Source Tags**: Click "Generate Tags" to create 5-8 topical tags for the source
2. **Add Custom Tags**: Add your own tags manually if needed
3. **Choose Processing Mode**:
   - **Quick Mode**: Simple quote titles, no per-quote tags (~5 seconds)
   - **Full Mode**: AI-generated titles and tags for each quote (~10-60 seconds)

### Step 5: Download

- **Download All .md Files**: Directly download all markdown files to your computer
- **View & Copy Notes**: View and copy individual notes to paste into Obsidian
- **Show CSV**: Export all notes as a CSV file

## File Structure

The app generates three types of markdown notes:

### 1. Source Note
```yaml
---
note-type: source
tags:
  - attention-economy
  - digital-ethics
author: James Williams
year: 2018
publisher: Cambridge University Press
format: book
---

# Stand Out of Our Light

Summary of the book...
```

### 2. Author Note
```yaml
---
note-type: author
---
```

### 3. Quote Notes
```yaml
---
note-type: quote
source: "[[Stand Out of Our Light (Williams, 2018)]]"
author: "[[James Williams]]"
tags:
  - attention
  - freedom
citation: "Williams, J. (2018). Stand Out of Our Light..."
page: xii
---
> Your highlighted quote here
```

## Building for Production

To create a production build:

```bash
npm run build
```

The build output will be in the `dist/` directory.

To preview the production build:

```bash
npm run preview
```

## Security Notes

### For Local Use Only

This setup is designed for **local use only**. Your API key is:
- ✅ Stored in `.env` file (gitignored)
- ✅ Only accessible on your machine
- ✅ Used directly from the frontend (safe on localhost)

### ⚠️ DO NOT Deploy This to the Web

If you want to deploy this publicly, you **must** create a backend API to:
1. Store the API key server-side
2. Proxy requests to Anthropic's API
3. Add rate limiting

The current setup exposes your API key in the browser bundle, which is **only safe** when running locally.

## Troubleshooting

### API Key Not Working

- Make sure your `.env` file is in the `local-app` directory (not the repo root)
- Verify the key starts with `sk-ant-`
- Check the key is named exactly `VITE_ANTHROPIC_API_KEY`
- Restart the dev server after creating/editing `.env`

### "API Key Missing" Warning

If you see a red warning banner:
1. Create the `.env` file (see step 2 above)
2. Add your API key
3. Restart the dev server: `Ctrl+C` then `npm run dev`

### CORS Errors

If you see CORS errors in the console, make sure you're:
- Running on `localhost` (not a different domain)
- Using a valid, active API key

### Build Errors

If `npm run build` fails:
- Make sure all dependencies are installed: `npm install`
- Check that Node.js version is 16 or higher: `node --version`

## Cost Estimates

API usage costs (as of December 2024):
- **Quick Mode**: ~$0.01-0.02 per book (minimal API calls)
- **Full Mode**: ~$0.05-0.15 per book (depends on number of quotes)
- **Summary Generation**: ~$0.01 per summary
- **Tag Generation**: ~$0.01-0.02 per request

Web search tool usage may increase costs slightly.

## Development

### Project Structure

```
local-app/
├── src/
│   ├── App.jsx           # Main application component
│   ├── main.jsx          # React entry point
│   └── index.css         # Tailwind styles
├── public/               # Static assets
├── index.html            # HTML template
├── vite.config.js        # Vite configuration
├── tailwind.config.js    # Tailwind configuration
├── .env.example          # Environment template
├── .env                  # Your API key (gitignored!)
└── package.json          # Dependencies
```

### Technologies Used

- **React 18**: UI framework
- **Vite**: Build tool and dev server
- **Tailwind CSS**: Utility-first CSS
- **Lucide React**: Icon library
- **Anthropic Claude API**: AI-powered features

## Related Files

- **Python CLI**: `../scribsidian.py` - Command-line version with tag suggestion engine
- **Python TUI**: `../scribsidian_tui.py` - Terminal UI version
- **Original TSX**: `../kindle-to-obsidian.tsx` - Claude artifact version

## License

This is a personal tool for converting Kindle highlights to Obsidian notes.

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the main project documentation in `../CLAUDE.md`
3. Verify your API key is valid and properly configured

---

**Happy note-taking! 📚✨**
