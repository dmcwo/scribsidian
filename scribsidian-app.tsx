import React, { useState } from 'react';
import { BookOpen, Download, Sparkles, CheckCircle, Edit2, Plus, X } from 'lucide-react';

const ScribsidianApp = () => {
  const [step, setStep] = useState(1);
  const [highlightsText, setHighlightsText] = useState('');
  const [metadata, setMetadata] = useState({
    title: '',
    author: '',
    year: '',
    publisher: '',
    link: '',
    citation: '',
    tags: [],
    format: 'book'
  });
  const [quotes, setQuotes] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [currentProcessing, setCurrentProcessing] = useState(0);

  // Parsing functions
  const slugify = (text, maxLength = 60) => {
    return text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, maxLength)
      .replace(/-+$/, '');
  };

  const cleanQuoteText = (text) => {
    text = text.replace(/Page\s+\d+\s*$/g, '');
    text = text.replace(/\n/g, ' ');
    text = text.replace(/\s+/g, ' ');
    return text.trim();
  };

  const parseQuotes = (rawText) => {
    // Remove "Highlight Continued" lines to merge split quotes
    rawText = rawText.replace(/\n\d+\s*\nPage\s+\d+\s*\|\s*Highlight\s+Continued\s*\n/g, '\n');
    rawText = rawText.replace(/\nPage\s+\d+\s*\|\s*Highlight\s+Continued\s*\n/g, '\n');
    rawText = rawText.replace(/\d+Page\s+\d+\s*\|\s*Highlight\s+Continued/g, '');

    const pattern = /Page\s+(.*?)\s*\|\s*Highlight\s*\n(.*?)(?=\nPage\s+|\n*$)/gs;
    const matches = [...rawText.matchAll(pattern)];

    return matches.map(match => {
      const pageRaw = match[1].trim();
      const pageMatch = pageRaw.match(/(\d+)/);
      const pageNumber = pageMatch ? pageMatch[1] : pageRaw;

      return {
        page: pageNumber,
        text: cleanQuoteText(match[2]),
        filename: '',
        tags: [],
        suggestedTags: []
      };
    });
  };

  const handleParseHighlights = () => {
    const parsed = parseQuotes(highlightsText);
    setQuotes(parsed);
    setStep(2);
  };

  const handleMetadataSubmit = async () => {
    setStep(3);
    setProcessing(true);
    
    // Process each quote with AI
    for (let i = 0; i < quotes.length; i++) {
      setCurrentProcessing(i + 1);
      await processQuoteWithAI(i);
    }
    
    setProcessing(false);
  };

  const processQuoteWithAI = async (index) => {
    const quote = quotes[index];
    
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: `You are helping organize academic highlights from "${metadata.title}" by ${metadata.author}.

Generate a concise filename and tags for this quote. The filename should work as a natural phrase you'd use when citing this idea in writing.

Quote: "${quote.text}"

FILENAME GUIDELINES:
- Create a short phrase (4-8 words) that captures the core claim/argument
- Use present tense, active voice when possible
- Should read naturally in a sentence like: "Williams argues that [your filename here]"
- Examples:
  * "attention-liberation-is-prerequisite-for-change"
  * "ddos-attacks-model-attention-economy"
  * "human-wellbeing-requires-free-attention"
- NOT generic labels like "quote-about-attention" or "important-passage"

TAG GUIDELINES:
- 5-8 scholarly tags as lowercase hyphenated phrases
- Focus on: theoretical concepts, methodologies, themes, disciplines
- Enable cross-referencing with other ideas in knowledge base

Respond ONLY with valid JSON in this exact format:
{
  "filename": "4-8 word phrase capturing the core claim",
  "tags": ["tag-one", "tag-two", "tag-three", "tag-four", "tag-five"]
}`
          }]
        })
      });

      const data = await response.json();
      const text = data.content.find(c => c.type === 'text')?.text || '';
      
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const aiResult = JSON.parse(jsonMatch[0]);
        
        setQuotes(prev => {
          const updated = [...prev];
          updated[index] = {
            ...updated[index],
            filename: aiResult.filename || '',
            suggestedTags: aiResult.tags || [],
            tags: aiResult.tags || []
          };
          return updated;
        });
      }
    } catch (error) {
      console.error('AI processing failed:', error);
      // Fallback to simple slugification
      setQuotes(prev => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          filename: slugify(quote.text.substring(0, 50)),
          tags: []
        };
        return updated;
      });
    }
  };

  const updateQuote = (index, field, value) => {
    setQuotes(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addTag = (index, tag) => {
    const cleaned = tag.toLowerCase().replace(/\s+/g, '-');
    if (cleaned && !quotes[index].tags.includes(cleaned)) {
      updateQuote(index, 'tags', [...quotes[index].tags, cleaned]);
    }
  };

  const removeTag = (index, tag) => {
    updateQuote(index, 'tags', quotes[index].tags.filter(t => t !== tag));
  };

  const generateMarkdownFiles = () => {
    const files = [];
    const authorSlug = slugify(metadata.author);
    const sourceSlug = slugify(metadata.title);

    // Author note
    files.push({
      name: `${authorSlug}.md`,
      content: `---
note-type: author
---

A short bio can go here.`
    });

    // Source note
    const sourceTags = metadata.tags.length > 0 
      ? `tags:\n${metadata.tags.map(t => `  - ${t}`).join('\n')}\n`
      : '';
    
    files.push({
      name: `${sourceSlug}.md`,
      content: `---
note-type: source
${sourceTags}author: "[[${authorSlug}]]"
year: ${metadata.year}
publisher: ${metadata.publisher}
format: ${metadata.format}
link: "${metadata.link}"
citation: "${metadata.citation}"
---

# ${metadata.title}

Summary goes here.`
    });

    // Quote notes
    quotes.forEach(quote => {
      const filename = quote.filename || slugify(quote.text.substring(0, 50));
      const tagBlock = quote.tags.length > 0
        ? `tags:\n${quote.tags.map(t => `  - ${t}`).join('\n')}\n`
        : 'tags:\n  -\n';

      files.push({
        name: `${filename}.md`,
        content: `---
note-type: quote
source: "[[${sourceSlug}]]"
author: "[[${authorSlug}]]"
${tagBlock}page: ${quote.page}
---

> ${quote.text}`
      });
    });

    return files;
  };

  const downloadFiles = async () => {
    const files = generateMarkdownFiles();
    
    try {
      // Load JSZip from CDN
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      
      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
      
      const zip = new window.JSZip();
      
      files.forEach(file => {
        zip.file(file.name, file.content);
      });
      
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${slugify(metadata.title)}-highlights.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      alert('Download complete! Check your Downloads folder.');
    } catch (error) {
      console.error('Download failed:', error);
      alert('Download failed. Please check the console for details. Error: ' + error.message);
    }
  };

  const resetSession = () => {
    const confirmed = window.confirm('Start a new session? Current progress will be lost.');
    if (confirmed) {
      setStep(1);
      setHighlightsText('');
      setMetadata({
        title: '', author: '', year: '', publisher: '',
        link: '', citation: '', tags: [], format: 'book'
      });
      setQuotes([]);
      setProcessing(false);
      setCurrentProcessing(0);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-amber-900 to-red-900 text-amber-50 py-8 shadow-lg">
        <div className="max-w-4xl mx-auto px-6 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <BookOpen className="w-8 h-8" />
              <h1 className="text-4xl font-serif font-bold">Scribsidian</h1>
            </div>
            <p className="text-amber-100 text-sm">Transform Kindle highlights into Obsidian notes</p>
          </div>
          {step > 1 && (
            <button
              onClick={resetSession}
              className="bg-amber-700 hover:bg-amber-600 text-white px-4 py-2 rounded-lg font-semibold transition-all"
            >
              ← Start Over
            </button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-4 mb-12">
          {[1, 2, 3].map(num => (
            <div key={num} className="flex items-center gap-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${
                step >= num 
                  ? 'bg-amber-800 text-white shadow-md' 
                  : 'bg-amber-200 text-amber-700'
              }`}>
                {step > num ? <CheckCircle className="w-5 h-5" /> : num}
              </div>
              {num < 3 && <div className={`w-16 h-1 ${step > num ? 'bg-amber-800' : 'bg-amber-200'}`} />}
            </div>
          ))}
        </div>

        {/* Step 1: Paste Highlights */}
        {step === 1 && (
          <div className="bg-white rounded-lg shadow-xl p-8 border-2 border-amber-100">
            <h2 className="text-2xl font-serif font-bold text-amber-900 mb-4">
              Paste Your Kindle Highlights
            </h2>
            <p className="text-gray-600 mb-6">
              Copy and paste your highlights from the Kindle app or PDF. The tool will automatically handle page breaks and "Highlight Continued" markers.
            </p>
            <textarea
              value={highlightsText}
              onChange={(e) => setHighlightsText(e.target.value)}
              className="w-full h-96 p-4 border-2 border-amber-200 rounded-lg font-mono text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all"
              placeholder="Page 88 | Highlight
people were computers, however, the appropriate description of the digital attention economy's
incursions upon their processing capacities would be that of the distributed denial-of-service, or
13Page 88 | Highlight Continued
DDoS, attack..."
            />
            <button
              onClick={handleParseHighlights}
              disabled={!highlightsText.trim()}
              className="mt-6 w-full bg-gradient-to-r from-amber-800 to-red-800 text-white py-3 rounded-lg font-semibold hover:from-amber-900 hover:to-red-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
            >
              Parse Highlights
            </button>
          </div>
        )}

        {/* Step 2: Enter Metadata */}
        {step === 2 && (
          <div className="bg-white rounded-lg shadow-xl p-8 border-2 border-amber-100">
            <h2 className="text-2xl font-serif font-bold text-amber-900 mb-4">
              Book Metadata
            </h2>
            <p className="text-gray-600 mb-6">
              Found {quotes.length} quotes. Please provide book information.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  value={metadata.title}
                  onChange={(e) => setMetadata({...metadata, title: e.target.value})}
                  className="w-full p-3 border-2 border-amber-200 rounded-lg focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Author *</label>
                <input
                  type="text"
                  value={metadata.author}
                  onChange={(e) => setMetadata({...metadata, author: e.target.value})}
                  className="w-full p-3 border-2 border-amber-200 rounded-lg focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Year</label>
                  <input
                    type="text"
                    value={metadata.year}
                    onChange={(e) => setMetadata({...metadata, year: e.target.value})}
                    className="w-full p-3 border-2 border-amber-200 rounded-lg focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Publisher</label>
                  <input
                    type="text"
                    value={metadata.publisher}
                    onChange={(e) => setMetadata({...metadata, publisher: e.target.value})}
                    className="w-full p-3 border-2 border-amber-200 rounded-lg focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Link</label>
                <input
                  type="text"
                  value={metadata.link}
                  onChange={(e) => setMetadata({...metadata, link: e.target.value})}
                  className="w-full p-3 border-2 border-amber-200 rounded-lg focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Citation</label>
                <input
                  type="text"
                  value={metadata.citation}
                  onChange={(e) => setMetadata({...metadata, citation: e.target.value})}
                  className="w-full p-3 border-2 border-amber-200 rounded-lg focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                  placeholder="Williams, J. (2018). Stand Out of Our Light..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Source Tags (comma separated)</label>
                <input
                  type="text"
                  defaultValue={metadata.tags.join(', ')}
                  onBlur={(e) => setMetadata({...metadata, tags: e.target.value.split(',').map(t => t.trim().toLowerCase().replace(/\s+/g, '-')).filter(Boolean)})}
                  className="w-full p-3 border-2 border-amber-200 rounded-lg focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                  placeholder="attention, ethics, politics"
                />
              </div>
            </div>
            
            <div className="flex gap-4 mt-6">
              <button
                onClick={() => setStep(1)}
                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-all"
              >
                Back
              </button>
              <button
                onClick={handleMetadataSubmit}
                disabled={!metadata.title || !metadata.author}
                className="flex-1 bg-gradient-to-r from-amber-800 to-red-800 text-white py-3 rounded-lg font-semibold hover:from-amber-900 hover:to-red-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
              >
                Process with AI <Sparkles className="inline w-4 h-4 ml-2" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review & Edit */}
        {step === 3 && (
          <div className="space-y-6">
            {processing && (
              <div className="bg-white rounded-lg shadow-xl p-8 border-2 border-amber-100 text-center">
                <Sparkles className="w-12 h-12 text-amber-600 mx-auto mb-4 animate-pulse" />
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  Processing with AI...
                </h3>
                <p className="text-gray-600">
                  {currentProcessing} of {quotes.length} quotes processed
                </p>
              </div>
            )}
            
            {!processing && (
              <>
                <div className="bg-white rounded-lg shadow-xl p-6 border-2 border-amber-100">
                  <h2 className="text-2xl font-serif font-bold text-amber-900 mb-2">
                    Review Your Quotes
                  </h2>
                  <p className="text-gray-600">
                    AI has generated filenames and tags. Edit as needed before downloading.
                  </p>
                </div>

                {quotes.map((quote, index) => (
                  <QuoteCard
                    key={index}
                    quote={quote}
                    index={index}
                    updateQuote={updateQuote}
                    addTag={addTag}
                    removeTag={removeTag}
                  />
                ))}

                <div className="flex gap-4">
                  <button
                    onClick={resetSession}
                    className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-all"
                  >
                    Start New Session
                  </button>
                  <button
                    onClick={downloadFiles}
                    className="flex-1 bg-gradient-to-r from-amber-800 to-red-800 text-white py-3 rounded-lg font-semibold hover:from-amber-900 hover:to-red-900 transition-all shadow-md hover:shadow-lg"
                  >
                    <Download className="inline w-4 h-4 mr-2" />
                    Download ZIP
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

const QuoteCard = ({ quote, index, updateQuote, addTag, removeTag }) => {
  const [newTag, setNewTag] = useState('');
  const [editing, setEditing] = useState(false);

  const handleAddTag = () => {
    if (newTag.trim()) {
      addTag(index, newTag);
      setNewTag('');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-amber-100 hover:border-amber-300 transition-all">
      <div className="flex items-start justify-between mb-4">
        <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-3 py-1 rounded-full">
          Page {quote.page}
        </span>
      </div>

      <blockquote className="text-gray-700 italic mb-6 pl-4 border-l-4 border-amber-300">
        {quote.text}
      </blockquote>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Filename
            <button
              onClick={() => setEditing(!editing)}
              className="ml-2 text-amber-600 hover:text-amber-800"
            >
              <Edit2 className="inline w-3 h-3" />
            </button>
          </label>
          {editing ? (
            <input
              type="text"
              value={quote.filename}
              onChange={(e) => updateQuote(index, 'filename', e.target.value)}
              onBlur={() => setEditing(false)}
              className="w-full p-2 border-2 border-amber-200 rounded-lg text-sm font-mono focus:border-amber-500"
              autoFocus
            />
          ) : (
            <div className="p-2 bg-gray-50 rounded-lg text-sm font-mono text-gray-800">
              {quote.filename || 'unnamed'}.md
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Tags</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {quote.tags.map((tag, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-sm"
              >
                {tag}
                <button
                  onClick={() => removeTag(index, tag)}
                  className="hover:text-amber-900"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
              placeholder="Add tag..."
              className="flex-1 p-2 border-2 border-amber-200 rounded-lg text-sm focus:border-amber-500"
            />
            <button
              onClick={handleAddTag}
              className="bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition-all"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScribsidianApp;