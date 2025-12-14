import React, { useState } from 'react';
import { BookOpen, Tag, FileText, Download, Sparkles, Edit2, Plus, X, Check, ChevronRight, Zap, Clock } from 'lucide-react';

export default function KindleToObsidian() {
  // Get API key from environment variable
  const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

  const [step, setStep] = useState(1);
  const [quotes, setQuotes] = useState('');
  const [sourceInput, setSourceInput] = useState('');
  const [sourceType, setSourceType] = useState('citation');
  const [useManualEntry, setUseManualEntry] = useState(false);
  const [parsedSource, setParsedSource] = useState(null);
  const [sourceTags, setSourceTags] = useState([]);
  const [summary, setSummary] = useState('');
  const [newTag, setNewTag] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMode, setProcessingMode] = useState('full');
  const [generatedNotes, setGeneratedNotes] = useState(null);
  const [progress, setProgress] = useState({ current: 0, total: 0, message: '' });
  const [copyStatus, setCopyStatus] = useState('');
  const [showCSV, setShowCSV] = useState(false);
  const [csvContent, setCSVContent] = useState('');
  const [testMode, setTestMode] = useState(false);
  const [showMarkdown, setShowMarkdown] = useState(false);
  const [selectedNote, setSelectedNote] = useState(null);
  const [isGeneratingTags, setIsGeneratingTags] = useState(false);

  const loadTestData = () => {
    setQuotes(`Page xi | Highlight
In order to do anything that matters, we must first be able to give attention to the things that matter.
Page xii | Highlight
"want what we want to want."
Page xii | Highlight
liberation of human attention may be the defining moral and political struggle of our time. Its success is prerequisite for the success of virtually all other struggles.`);
    setSourceInput('Williams, J. (2018). Stand out of our Light: Freedom and Resistance in the Attention Economy. Cambridge University Press.');
    setSummary('Stand Out of Our Light by James Williams argues that digital technology, designed to capture our scarce attention, poses a serious threat to human freedom and autonomy, shifting focus from our genuine goals to what tech companies want us to do. Williams calls for a new ethics and regulation in this "attention economy," making that case that we must resist manipulation, protect individual will, and reclaim control over our lives and society.');
    setTestMode(true);
  };

  const [manualSource, setManualSource] = useState({
    title: '',
    author: '',
    year: '',
    publisher: '',
    format: 'book',
    link: ''
  });

  // Helper function to clean titles - remove special characters
  const cleanTitle = (title) => {
    return title.replace(/[:/\\]/g, '').trim();
  };

  // Helper function to simplify source title (remove subtitle)
  const simplifySourceTitle = (title) => {
    const mainTitle = title.split(':')[0].trim();
    return cleanTitle(mainTitle);
  };

  // Helper function to generate APA citation
  const generateCitation = (source) => {
    const parts = [];
    if (source.author) parts.push(`${source.author}`);
    if (source.year) parts.push(`(${source.year})`);

    let citation = parts.join(' ') + '.';
    if (source.title) citation += ` ${source.title}.`;
    if (source.publisher) citation += ` ${source.publisher}.`;

    return citation;
  };

  const parseKindleQuotes = (text) => {
    const lines = text.split('\n');
    const quotesArray = [];
    let currentQuote = { page: '', text: '' };

    for (let line of lines) {
      if (line.startsWith('Page ') && line.includes('Highlight')) {
        if (currentQuote.text) {
          quotesArray.push({ ...currentQuote });
        }
        const pageMatch = line.match(/Page ([^|]+)/);
        currentQuote = { page: pageMatch ? pageMatch[1].trim() : '', text: '' };
      } else if (line.trim() && !line.startsWith('Page ')) {
        currentQuote.text += (currentQuote.text ? ' ' : '') + line.trim();
      }
    }
    if (currentQuote.text) {
      quotesArray.push(currentQuote);
    }
    return quotesArray;
  };

  const parseSourceInfo = async () => {
    if (useManualEntry) {
      setParsedSource(manualSource);
      setStep(3);
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: `Extract bibliographic information from this source (${sourceType}): "${sourceInput}". Return ONLY valid JSON with these fields: title, author, year, publisher, format (book/article/etc), link (if DOI or URL is provided). If any field is unknown, use null.`
          }]
        })
      });

      const data = await response.json();
      const text = data.content[0].text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(text);
      setParsedSource(parsed);
      setStep(3);
    } catch (err) {
      console.error('Parse error:', err);
      alert('Could not parse source. Please try again or use manual entry.');
    }
    setIsProcessing(false);
  };

  const generateSourceTags = async () => {
    setIsGeneratingTags(true);
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: `Based on this work - Title: "${parsedSource.title}", Author: ${parsedSource.author}, Summary: "${summary || 'No summary yet'}".

Generate 5-8 highly specific topical tags that capture the main themes, concepts, and subject areas discussed in this work.

IMPORTANT RULES:
- Return tags as single words or hyphenated phrases ONLY (e.g., "attention-economy", "digital-ethics", "freedom", "political-theory")
- Do NOT use any prefixes like "topics/", "#", or any other prefix
- Tags should be substantive and reflect actual themes from the summary
- Avoid generic tags like "literature", "reading", or "book"
- Use specific academic or topical terms

Return ONLY a JSON array of tag strings without any prefix: ["tag1", "tag2", "tag3"]`
          }],
          tools: [{ type: "web_search_20250305", name: "web_search" }]
        })
      });

      const data = await response.json();
      let text = data.content.map(item => item.type === 'text' ? item.text : '').join('\n');
      text = text.replace(/```json|```/g, '').trim();
      const tags = JSON.parse(text);
      // Clean any remaining prefixes that might have slipped through
      const cleanedTags = tags.map(tag => tag.replace(/^#/, '').replace(/^topics\//, ''));
      setSourceTags(cleanedTags);
    } catch (err) {
      console.error('Tag generation error:', err);
      setSourceTags(['topics/literature']);
    }
    setIsGeneratingTags(false);
  };

  const generateSummary = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: `Write a concise 2-3 sentence summary of "${parsedSource.title}" by ${parsedSource.author}. Focus on main themes and arguments.`
          }],
          tools: [{ type: "web_search_20250305", name: "web_search" }]
        })
      });

      const data = await response.json();
      const summaryText = data.content.map(item => item.type === 'text' ? item.text : '').join(' ');
      setSummary(summaryText);
    } catch (err) {
      console.error('Summary error:', err);
    }
    setIsProcessing(false);
  };

  const generateNotes = async () => {
    setIsProcessing(true);
    const quotesArray = parseKindleQuotes(quotes);
    setProgress({ current: 0, total: quotesArray.length, message: 'Starting...' });

    try {
      let quoteDetails;

      if (processingMode === 'quick') {
        setProgress({ current: quotesArray.length, total: quotesArray.length, message: 'Creating notes in quick mode...' });
        quoteDetails = quotesArray.map((quote, i) => ({
          title: quote.text.substring(0, 50).trim() + (quote.text.length > 50 ? '...' : ''),
          tags: []
        }));
      } else {
        setProgress({ current: 0, total: quotesArray.length, message: 'Analyzing all quotes...' });

        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': API_KEY,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 8000,
            messages: [{
              role: 'user',
              content: `For each of these ${quotesArray.length} quotes from "${parsedSource.title}", generate:
1. A concise lowercase title (a summary of the main idea as it might flow in text)
2. 4-6 specific tags as single words or hyphenated phrases

CRITICAL: Tags must be plain words with NO prefixes. Do NOT use "topics/", "#", or any prefix.
Good examples: "attention", "digital-ethics", "freedom", "political-theory"
Bad examples: "#attention", "topics/ethics", "#topics/freedom"

Return ONLY valid JSON as an array of objects with "title" and "tags" fields.

Example format:
[{"title": "attention precedes meaningful action", "tags": ["attention", "priority", "mindfulness", "focus"]}]

Quotes:
${quotesArray.map((q, i) => `${i + 1}. "${q.text}"`).join('\n\n')}`
            }]
          })
        });

        const data = await response.json();
        const text = data.content[0].text.replace(/```json|```/g, '').trim();
        quoteDetails = JSON.parse(text);

        // Clean any prefixes from tags
        quoteDetails = quoteDetails.map(detail => ({
          ...detail,
          tags: detail.tags ? detail.tags.map(t => t.replace(/^#/, '').replace(/^topics\//, '')) : []
        }));

        setProgress({ current: quotesArray.length, total: quotesArray.length, message: 'Creating notes...' });
      }

      const simplifiedTitle = simplifySourceTitle(parsedSource.title);
      const authorLastName = parsedSource.author.split(',')[0].trim();
      const authorFullName = parsedSource.author.includes(',')
        ? parsedSource.author.split(',').reverse().map(p => p.trim()).join(' ')
        : parsedSource.author;
      const citation = generateCitation(parsedSource);

      const sourceNote = {
        filename: `${simplifiedTitle} (${authorLastName}, ${parsedSource.year}).md`,
        content: `---
note-type: source
tags:
${sourceTags.map(t => `  - ${t.replace(/^#/, '')}`).join('\n')}
author: ${authorFullName}
year: ${parsedSource.year}
${parsedSource.publisher ? `publisher: ${parsedSource.publisher}` : ''}
format: ${parsedSource.format || 'book'}
---

# ${simplifiedTitle}

${summary}
`
      };

      const authorNote = {
        filename: `${authorFullName}.md`,
        content: `---
note-type: author
---
`
      };

      const quoteNotes = quotesArray.map((quote, i) => {
        const quoteTitle = `${quoteDetails[i].title} (${authorLastName}, ${parsedSource.year})`;
        const cleanedQuoteTitle = cleanTitle(quoteTitle);

        return {
          filename: `${cleanedQuoteTitle}.md`,
          content: `---
note-type: quote
source: "[[${simplifiedTitle} (${authorLastName}, ${parsedSource.year})]]"
author: "[[${authorFullName}]]"
tags:
${quoteDetails[i].tags && quoteDetails[i].tags.length > 0 ? quoteDetails[i].tags.map(t => `  - ${t.replace(/^#/, '')}`).join('\n') : ''}
citation: "${citation}"
${quote.page ? `page: ${quote.page}` : ''}
${parsedSource.link ? `link: ${parsedSource.link}` : ''}
---
> ${quote.text}
`
        };
      });

      setGeneratedNotes({ sourceNote, authorNote, quoteNotes });
      setStep(5);
    } catch (err) {
      console.error('Note generation error:', err);
      alert('Error generating notes. Please try again or use Quick mode for large collections.');
    }
    setIsProcessing(false);
    setProgress({ current: 0, total: 0, message: '' });
  };

  const generateCSV = () => {
    if (!generatedNotes) return '';

    const allNotes = [generatedNotes.sourceNote, generatedNotes.authorNote, ...generatedNotes.quoteNotes];

    const escapeCSV = (str) => {
      if (!str) return '';
      const stringValue = String(str);
      if (stringValue.includes('"') || stringValue.includes(',') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    // Extract metadata from each note's YAML frontmatter
    const parseNote = (note) => {
      const yamlMatch = note.content.match(/^---\n([\s\S]*?)\n---/);
      const yaml = yamlMatch ? yamlMatch[1] : '';
      const bodyContent = note.content.replace(/^---\n[\s\S]*?\n---\n/, '');

      // Parse YAML fields
      const getField = (field) => {
        const match = yaml.match(new RegExp(`${field}:\\s*(.+)`));
        return match ? match[1].replace(/^["']|["']$/g, '') : '';
      };

      return {
        filename: note.filename.replace(/\.md$/, ''),
        title: getField('title') || getField('name') || '',
        source: getField('source'),
        author: getField('author'),
        year: getField('year'),
        publisher: getField('publisher'),
        format: getField('format'),
        page: getField('page'),
        noteType: getField('note-type'),
        tags: getField('tags'),
        body: bodyContent.trim()
      };
    };

    const headers = ['filename', 'title', 'source', 'author', 'year', 'publisher', 'format', 'page', 'note-type', 'tags', 'body'];

    const rows = allNotes.map(note => {
      const parsed = parseNote(note);
      return [
        escapeCSV(parsed.filename),
        escapeCSV(parsed.title),
        escapeCSV(parsed.source),
        escapeCSV(parsed.author),
        escapeCSV(parsed.year),
        escapeCSV(parsed.publisher),
        escapeCSV(parsed.format),
        escapeCSV(parsed.page),
        escapeCSV(parsed.noteType),
        escapeCSV(parsed.tags),
        escapeCSV(parsed.body)
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  };

  const copyCSVToClipboard = async () => {
    const csv = generateCSV();
    try {
      await navigator.clipboard.writeText(csv);
      setCopyStatus('✓ Copied!');
      setTimeout(() => setCopyStatus(''), 3000);
    } catch (err) {
      setCopyStatus('✗ Failed');
      console.error('Copy failed:', err);
    }
  };

  const copyNoteToClipboard = async (note) => {
    try {
      await navigator.clipboard.writeText(note.content);
      setCopyStatus(`✓ Copied ${note.filename}!`);
      setTimeout(() => setCopyStatus(''), 3000);
    } catch (err) {
      setCopyStatus('✗ Failed');
      console.error('Copy failed:', err);
    }
  };

  const showCSVText = () => {
    setCSVContent(generateCSV());
    setShowCSV(true);
  };

  const showMarkdownView = () => {
    setShowMarkdown(true);
  };

  const downloadAllMarkdown = async () => {
    if (!generatedNotes) return;
    const allNotes = [generatedNotes.sourceNote, generatedNotes.authorNote, ...generatedNotes.quoteNotes];

    for (let i = 0; i < allNotes.length; i++) {
      const note = allNotes[i];
      const blob = new Blob([note.content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = note.filename;
      a.click();
      URL.revokeObjectURL(url);

      if (i < allNotes.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  };

  const addTag = () => {
    if (newTag && !sourceTags.includes(newTag)) {
      const cleanTag = newTag.replace(/^#/, '').replace(/^topics\//, '');
      setSourceTags([...sourceTags, cleanTag]);
      setNewTag('');
    }
  };

  const removeTag = (tag) => {
    setSourceTags(sourceTags.filter(t => t !== tag));
  };

  const quotesArray = parseKindleQuotes(quotes);
  const estimatedTime = processingMode === 'quick' ? '~5 seconds' : quotesArray.length > 50 ? '~30-60 seconds' : '~10-20 seconds';

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-stone-50 to-slate-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <BookOpen className="w-10 h-10 text-amber-700" />
            <h1 className="text-4xl font-serif text-stone-800">Kindle to Obsidian</h1>
          </div>
          <p className="text-stone-600 italic">Transform your highlights into a connected knowledge graph</p>
          {!API_KEY && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">
                ⚠️ <strong>API Key Missing:</strong> Please create a <code className="bg-red-100 px-1">.env</code> file with your <code className="bg-red-100 px-1">VITE_ANTHROPIC_API_KEY</code>
              </p>
            </div>
          )}
          {step === 1 && (
            <button
              onClick={loadTestData}
              className="mt-4 text-xs px-3 py-1 bg-stone-200 hover:bg-stone-300 text-stone-600 rounded transition-colors"
            >
              Load Test Data
            </button>
          )}
        </div>

        <div className="flex justify-between mb-12 px-4">
          {[1, 2, 3, 4, 5].map(num => (
            <div key={num} className="flex flex-col items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                step >= num ? 'bg-amber-700 border-amber-700 text-white' : 'bg-white border-stone-300 text-stone-400'
              }`}>
                {num}
              </div>
              <span className="text-xs mt-2 text-stone-600 font-serif">
                {['Quotes', 'Source', 'Review', 'Tags', 'Download'][num - 1]}
              </span>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8 border border-stone-200">
          {step === 1 && (
            <div>
              <h2 className="text-2xl font-serif text-stone-800 mb-4 flex items-center gap-2">
                <FileText className="w-6 h-6" />
                Paste Your Kindle Highlights
              </h2>
              <textarea
                value={quotes}
                onChange={(e) => setQuotes(e.target.value)}
                className="w-full h-64 p-4 border border-stone-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                placeholder="Page xii | Highlight&#10;liberation of human attention may be the defining moral and political struggle of our time..."
              />
              {quotesArray.length > 0 && (
                <p className="text-sm text-stone-600 mt-2 font-serif">
                  📚 Detected {quotesArray.length} quote{quotesArray.length !== 1 ? 's' : ''}
                </p>
              )}
              <button
                onClick={() => quotes.trim() ? setStep(2) : null}
                disabled={!quotes.trim()}
                className="mt-4 px-6 py-3 bg-amber-700 text-white rounded-lg hover:bg-amber-800 disabled:bg-stone-300 disabled:cursor-not-allowed transition-colors font-serif flex items-center gap-2"
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-2xl font-serif text-stone-800 mb-4 flex items-center gap-2">
                <BookOpen className="w-6 h-6" />
                Add Source Information
              </h2>

              <div className="mb-6 flex gap-4">
                <button
                  onClick={() => setUseManualEntry(false)}
                  className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                    !useManualEntry
                      ? 'border-amber-700 bg-amber-50'
                      : 'border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-5 h-5 text-amber-700" />
                    <span className="font-serif font-semibold">AI Parse</span>
                  </div>
                  <p className="text-sm text-stone-600">Paste citation, DOI, or URL</p>
                </button>
                <button
                  onClick={() => setUseManualEntry(true)}
                  className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                    useManualEntry
                      ? 'border-amber-700 bg-amber-50'
                      : 'border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Edit2 className="w-5 h-5 text-amber-700" />
                    <span className="font-serif font-semibold">Manual Entry</span>
                  </div>
                  <p className="text-sm text-stone-600">Fill in fields yourself</p>
                </button>
              </div>

              {!useManualEntry ? (
                <div>
                  <div className="mb-4">
                    <label className="block text-sm font-serif text-stone-700 mb-2">Source Type</label>
                    <select
                      value={sourceType}
                      onChange={(e) => setSourceType(e.target.value)}
                      className="w-full p-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="citation">Citation</option>
                      <option value="doi">DOI</option>
                      <option value="url">URL</option>
                    </select>
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-serif text-stone-700 mb-2">
                      {sourceType === 'citation' ? 'Full Citation' : sourceType === 'doi' ? 'DOI' : 'URL'}
                    </label>
                    <input
                      type="text"
                      value={sourceInput}
                      onChange={(e) => setSourceInput(e.target.value)}
                      className="w-full p-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                      placeholder="Williams, J. (2018). Stand out of our Light..."
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-serif text-stone-700 mb-2">Title *</label>
                    <input
                      type="text"
                      value={manualSource.title}
                      onChange={(e) => setManualSource({...manualSource, title: e.target.value})}
                      className="w-full p-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                      placeholder="Stand out of our Light"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-serif text-stone-700 mb-2">Author *</label>
                    <input
                      type="text"
                      value={manualSource.author}
                      onChange={(e) => setManualSource({...manualSource, author: e.target.value})}
                      className="w-full p-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                      placeholder="James Williams"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-serif text-stone-700 mb-2">Year *</label>
                      <input
                        type="text"
                        value={manualSource.year}
                        onChange={(e) => setManualSource({...manualSource, year: e.target.value})}
                        className="w-full p-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                        placeholder="2018"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-serif text-stone-700 mb-2">Format</label>
                      <select
                        value={manualSource.format}
                        onChange={(e) => setManualSource({...manualSource, format: e.target.value})}
                        className="w-full p-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="book">Book</option>
                        <option value="article">Article</option>
                        <option value="essay">Essay</option>
                        <option value="paper">Paper</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-serif text-stone-700 mb-2">Publisher</label>
                    <input
                      type="text"
                      value={manualSource.publisher}
                      onChange={(e) => setManualSource({...manualSource, publisher: e.target.value})}
                      className="w-full p-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                      placeholder="Cambridge University Press"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-serif text-stone-700 mb-2">Link/DOI (optional)</label>
                    <input
                      type="text"
                      value={manualSource.link}
                      onChange={(e) => setManualSource({...manualSource, link: e.target.value})}
                      className="w-full p-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                      placeholder="https://doi.org/10.1017/9781108453004"
                    />
                  </div>
                </div>
              )}

              <button
                onClick={parseSourceInfo}
                disabled={
                  (!useManualEntry && !sourceInput.trim()) ||
                  (useManualEntry && (!manualSource.title || !manualSource.author || !manualSource.year)) ||
                  isProcessing ||
                  !API_KEY
                }
                className="mt-6 px-6 py-3 bg-amber-700 text-white rounded-lg hover:bg-amber-800 disabled:bg-stone-300 disabled:cursor-not-allowed transition-colors font-serif flex items-center gap-2"
              >
                {isProcessing ? 'Processing...' : useManualEntry ? 'Continue' : 'Parse Source'}
                {!isProcessing && <ChevronRight className="w-4 h-4" />}
              </button>
            </div>
          )}

          {step === 3 && parsedSource && (
            <div>
              <h2 className="text-2xl font-serif text-stone-800 mb-4 flex items-center gap-2">
                <Check className="w-6 h-6" />
                Review Source Details
              </h2>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-900 font-serif">
                  <strong>Preview:</strong> Title will be simplified to: "<span className="font-mono">{simplifySourceTitle(parsedSource.title)}</span>"
                </p>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-serif text-stone-700 mb-2">Title</label>
                  <input
                    type="text"
                    value={parsedSource.title}
                    onChange={(e) => setParsedSource({...parsedSource, title: e.target.value})}
                    className="w-full p-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="text-xs text-stone-500 mt-1">Subtitles after ":" will be removed, and special characters : / \ will be cleaned</p>
                </div>
                <div>
                  <label className="block text-sm font-serif text-stone-700 mb-2">Author</label>
                  <input
                    type="text"
                    value={parsedSource.author}
                    onChange={(e) => setParsedSource({...parsedSource, author: e.target.value})}
                    className="w-full p-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-serif text-stone-700 mb-2">Year</label>
                    <input
                      type="text"
                      value={parsedSource.year}
                      onChange={(e) => setParsedSource({...parsedSource, year: e.target.value})}
                      className="w-full p-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-serif text-stone-700 mb-2">Format</label>
                    <select
                      value={parsedSource.format || 'book'}
                      onChange={(e) => setParsedSource({...parsedSource, format: e.target.value})}
                      className="w-full p-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="book">Book</option>
                      <option value="article">Article</option>
                      <option value="essay">Essay</option>
                      <option value="paper">Paper</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-serif text-stone-700 mb-2">Publisher</label>
                  <input
                    type="text"
                    value={parsedSource.publisher || ''}
                    onChange={(e) => setParsedSource({...parsedSource, publisher: e.target.value})}
                    className="w-full p-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-serif text-stone-700 mb-2">Link/DOI (optional)</label>
                  <input
                    type="text"
                    value={parsedSource.link || ''}
                    onChange={(e) => setParsedSource({...parsedSource, link: e.target.value})}
                    className="w-full p-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                    placeholder="https://doi.org/..."
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-serif text-stone-700">Summary (optional - or add in next step)</label>
                    <button
                      onClick={generateSummary}
                      disabled={isProcessing || !API_KEY}
                      className="text-sm px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded transition-colors flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" />
                      {isProcessing ? 'Generating...' : 'Generate'}
                    </button>
                  </div>
                  <textarea
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    className="w-full h-32 p-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 font-serif text-sm"
                    placeholder="Write or generate a brief summary..."
                  />
                </div>
              </div>

              <button
                onClick={() => setStep(4)}
                className="px-6 py-3 bg-amber-700 text-white rounded-lg hover:bg-amber-800 transition-colors font-serif flex items-center gap-2"
              >
                Continue to Tags
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {step === 4 && (
            <div>
              <h2 className="text-2xl font-serif text-stone-800 mb-4 flex items-center gap-2">
                <Tag className="w-6 h-6" />
                Tags & Processing Options
              </h2>

              {!summary && (
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-serif text-stone-700">Summary (recommended for better tags)</label>
                    <button
                      onClick={generateSummary}
                      disabled={isProcessing || !API_KEY}
                      className="text-sm px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded transition-colors flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" />
                      {isProcessing ? 'Generating...' : 'Generate'}
                    </button>
                  </div>
                  <textarea
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    className="w-full h-32 p-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 font-serif text-sm"
                    placeholder="Write or generate a brief summary..."
                  />
                </div>
              )}

              <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-serif text-stone-700">Source-Level Topic Tags</label>
                  {sourceTags.length === 0 && (
                    <button
                      onClick={generateSourceTags}
                      disabled={isGeneratingTags || !API_KEY}
                      className="text-sm px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded transition-colors flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" />
                      {isGeneratingTags ? 'Generating...' : 'Generate Tags'}
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {sourceTags.map(tag => (
                    <span key={tag} className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm font-mono flex items-center gap-2">
                      {tag}
                      <X className="w-3 h-3 cursor-pointer hover:text-amber-900" onClick={() => removeTag(tag)} />
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addTag()}
                    className="flex-1 p-2 border border-stone-300 rounded-lg text-sm font-mono"
                    placeholder="new-tag"
                  />
                  <button
                    onClick={addTag}
                    className="px-4 py-2 bg-stone-200 hover:bg-stone-300 rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-serif text-stone-700 mb-3">Processing Mode</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setProcessingMode('quick')}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      processingMode === 'quick'
                        ? 'border-amber-700 bg-amber-50'
                        : 'border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="w-5 h-5 text-amber-700" />
                      <span className="font-serif font-semibold">Quick Mode</span>
                    </div>
                    <p className="text-sm text-stone-600 mb-2">Fast processing, minimal AI calls</p>
                    <ul className="text-xs text-stone-500 space-y-1">
                      <li>• No per-quote tags</li>
                      <li>• Simple quote titles</li>
                      <li>• Best for large collections (50+ quotes)</li>
                      <li>• Est. time: ~5 seconds</li>
                    </ul>
                  </button>

                  <button
                    onClick={() => setProcessingMode('full')}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      processingMode === 'full'
                        ? 'border-amber-700 bg-amber-50'
                        : 'border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-5 h-5 text-amber-700" />
                      <span className="font-serif font-semibold">Full Mode</span>
                    </div>
                    <p className="text-sm text-stone-600 mb-2">Rich metadata and custom tags</p>
                    <ul className="text-xs text-stone-500 space-y-1">
                      <li>• Custom tags for each quote</li>
                      <li>• AI-generated quote titles</li>
                      <li>• Best for focused reading (under 50 quotes)</li>
                      <li>• Est. time: {estimatedTime}</li>
                    </ul>
                  </button>
                </div>
              </div>

              <button
                onClick={generateNotes}
                disabled={isProcessing || !API_KEY}
                className="px-6 py-3 bg-amber-700 text-white rounded-lg hover:bg-amber-800 disabled:bg-stone-300 transition-colors font-serif flex items-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin" />
                    {progress.message || 'Creating Notes...'}
                  </>
                ) : (
                  <>
                    Generate Notes
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {isProcessing && progress.total > 0 && (
                <div className="mt-4">
                  <div className="flex justify-between text-sm text-stone-600 mb-2">
                    <span className="font-serif">{progress.message}</span>
                    <span className="font-mono">{progress.current}/{progress.total}</span>
                  </div>
                  <div className="w-full bg-stone-200 rounded-full h-2">
                    <div
                      className="bg-amber-700 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(progress.current / progress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 5 && generatedNotes && !showCSV && !showMarkdown && (
            <div>
              <h2 className="text-2xl font-serif text-stone-800 mb-4 flex items-center gap-2">
                <Download className="w-6 h-6" />
                Your Notes Are Ready!
              </h2>

              <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
                <p className="font-serif text-green-900 mb-4">
                  Generated {1 + 1 + generatedNotes.quoteNotes.length} notes:
                </p>
                <ul className="space-y-2 text-sm font-mono text-green-800 max-h-64 overflow-y-auto">
                  <li>✓ {generatedNotes.sourceNote.filename}</li>
                  <li>✓ {generatedNotes.authorNote.filename}</li>
                  {generatedNotes.quoteNotes.map((note, i) => (
                    <li key={i}>✓ {note.filename}</li>
                  ))}
                </ul>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={showMarkdownView}
                    className="px-6 py-4 bg-amber-700 text-white rounded-lg hover:bg-amber-800 transition-colors font-serif flex items-center justify-center gap-2 text-lg"
                  >
                    <FileText className="w-5 h-5" />
                    View & Copy Notes
                  </button>
                  <button
                    onClick={showCSVText}
                    className="px-6 py-4 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-serif flex items-center justify-center gap-2 text-lg"
                  >
                    <FileText className="w-5 h-5" />
                    Show CSV
                  </button>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-900 font-serif mb-2">
                    <strong>💡 Direct Download (works when running locally):</strong>
                  </p>
                  <div className="grid grid-cols-1 gap-2 mb-2">
                    <button
                      onClick={downloadAllMarkdown}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Download All .md Files
                    </button>
                  </div>
                  <p className="text-xs text-blue-700 italic">
                    This will download all markdown files directly to your computer!
                  </p>
                </div>

                <button
                  onClick={() => {
                    setStep(1);
                    setQuotes('');
                    setSourceInput('');
                    setParsedSource(null);
                    setSourceTags([]);
                    setSummary('');
                    setGeneratedNotes(null);
                    setManualSource({ title: '', author: '', year: '', publisher: '', format: 'book', link: '' });
                    setCopyStatus('');
                    setShowCSV(false);
                    setCSVContent('');
                    setShowMarkdown(false);
                    setSelectedNote(null);
                  }}
                  className="w-full px-6 py-3 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-lg transition-colors font-serif"
                >
                  Start New Conversion
                </button>
              </div>
            </div>
          )}

          {step === 5 && generatedNotes && showMarkdown && (
            <div>
              <h2 className="text-2xl font-serif text-stone-800 mb-4 flex items-center gap-2">
                <FileText className="w-6 h-6" />
                View & Copy Markdown Files
              </h2>

              <div className="mb-4">
                <button
                  onClick={() => setShowMarkdown(false)}
                  className="px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-lg transition-colors font-serif text-sm"
                >
                  ← Back
                </button>
              </div>

              <div className="space-y-3">
                {[generatedNotes.sourceNote, generatedNotes.authorNote, ...generatedNotes.quoteNotes].map((note, i) => (
                  <div key={i} className="border border-stone-300 rounded-lg overflow-hidden">
                    <div className="bg-stone-100 px-4 py-2 flex justify-between items-center">
                      <span className="font-mono text-sm text-stone-700">{note.filename}</span>
                      <button
                        onClick={() => copyNoteToClipboard(note)}
                        className="px-3 py-1 bg-amber-700 hover:bg-amber-800 text-white text-xs rounded transition-colors"
                      >
                        Copy
                      </button>
                    </div>
                    <div className="bg-white p-4">
                      <pre className="text-xs font-mono text-stone-800 whitespace-pre-wrap max-h-48 overflow-y-auto">
                        {note.content}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>

              {copyStatus && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-center text-sm text-green-800 font-serif">
                  {copyStatus}
                </div>
              )}

              <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900 font-serif">
                  <strong>Workflow:</strong> Click "Copy" on each note, then create a new file in your Obsidian vault and paste the content. The filename is shown at the top of each section.
                </p>
              </div>
            </div>
          )}

          {step === 5 && generatedNotes && showCSV && (
            <div>
              <h2 className="text-2xl font-serif text-stone-800 mb-4 flex items-center gap-2">
                <FileText className="w-6 h-6" />
                CSV Content
              </h2>

              <div className="mb-4 flex gap-2">
                <button
                  onClick={copyCSVToClipboard}
                  className="flex-1 px-4 py-3 bg-amber-700 text-white rounded-lg hover:bg-amber-800 transition-colors font-serif flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  {copyStatus || 'Copy to Clipboard'}
                </button>
                <button
                  onClick={() => setShowCSV(false)}
                  className="px-4 py-3 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-lg transition-colors font-serif"
                >
                  ← Back
                </button>
              </div>

              <div className="bg-stone-50 border border-stone-300 rounded-lg p-4 mb-4">
                <p className="text-xs text-stone-600 font-serif mb-2">
                  Click the button above to copy all CSV content to your clipboard, then paste into a text editor and save as .csv
                </p>
              </div>

              <textarea
                value={csvContent}
                readOnly
                className="w-full h-96 p-4 border border-stone-300 rounded-lg font-mono text-xs bg-white overflow-auto"
              />

              <p className="text-xs text-stone-500 italic text-center mt-4">
                {csvContent.split('\n').length - 1} rows • {(new Blob([csvContent]).size / 1024).toFixed(1)} KB
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
