import React, { useState } from 'react';
import { BookOpen, Download, Sparkles, CheckCircle, Edit2, Plus, X, Zap, ZapOff, Rocket } from 'lucide-react';

const ScribsidianApp = () => {
  const [step, setStep] = useState(1);
  const [highlightsText, setHighlightsText] = useState('');
  const [metadata, setMetadata] = useState({
    title: '',
    authors: [],
    authorBio: '',
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
  const [aiMode, setAiMode] = useState('low');
  const [testMode, setTestMode] = useState(false);

  const loadTestData = () => {
    const testHighlights = `Page 88 | Highlight
What do you pay when you pay attention? You pay with all the things you could have attended to, but didn't: all the goals you didn't pursue, all the actions you didn't take, and all the possible yous you could have been, had you attended to those other things. Attention is paid in possible futures forgone.

Page 92 | Highlight
The liberation of human attention may be the defining moral and political struggle of our time.

Page 15 | Highlight
What we do with our attention matters more than we think, because our attention is all we really have.`;

    setHighlightsText(testHighlights);
    setMetadata({
      title: 'Stand Out of Our Light',
      authors: ['James Williams'],
      authorBio: 'James Wilson Williams (born 1982) is an American writer and academic. He was the winner of the inaugural Nine Dots Prize, in 2017. His first book, Stand Out of Our Light: Freedom and Resistance in the Attention Economy, was published in 2018 by Cambridge University Press. (Wikipedia)',
      year: '2018',
      publisher: 'Cambridge University Press',
      link: 'https://doi.org/10.1017/9781108453004',
      citation: 'Williams, J. (2018). Stand Out of Our Light: Freedom and Resistance in the Attention Economy. Cambridge University Press.',
      tags: ['attention-economy', 'digital-ethics', 'philosophy'],
      format: 'book'
    });
    setTestMode(true);
  };

  const slugify = (text, maxLength = 60) => {
    return text.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').substring(0, maxLength).replace(/-+$/, '');
  };

  const cleanQuoteText = (text) => {
    return text.replace(/Page\s+\d+\s*$/g, '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  };

  const parseQuotes = (rawText) => {
    rawText = rawText.replace(/\n\d+\s*\nPage\s+\d+\s*\|\s*Highlight\s+Continued\s*\n/g, '\n')
      .replace(/\nPage\s+\d+\s*\|\s*Highlight\s+Continued\s*\n/g, '\n')
      .replace(/\d+Page\s+\d+\s*\|\s*Highlight\s+Continued/g, '');

    const pattern = /Page\s+(.*?)\s*\|\s*Highlight\s*\n(.*?)(?=\nPage\s+|\n*$)/gs;
    const matches = [...rawText.matchAll(pattern)];

    return matches.map(match => {
      const pageRaw = match[1].trim();
      const pageMatch = pageRaw.match(/(\d+)/);
      const pageNumber = pageMatch ? pageMatch[1] : pageRaw;
      return { page: pageNumber, text: cleanQuoteText(match[2]), filename: '', tags: [], suggestedTags: [] };
    });
  };

  const handleParseHighlights = () => {
    setQuotes(parseQuotes(highlightsText));
    setStep(2);
  };

  const handleMetadataSubmit = async () => {
    setStep(3);
    if (aiMode === 'none') {
      setQuotes(prev => prev.map(quote => ({
        ...quote,
        filename: slugify(quote.text.substring(0, 50)),
        tags: [],
        suggestedTags: extractKeywordsFromQuote(quote.text)
      })));
    } else if (aiMode === 'low') {
      await processBatchWithAI();
    } else {
      await processIndividualWithAI();
    }
  };

  const extractKeywordsFromQuote = (text) => {
    const stopWords = new Set(['the','a','an','this','that','these','those','i','you','he','she','it','we','they','who','what','which','me','him','her','us','them','my','your','his','its','our','their','is','am','are','was','were','be','been','being','have','has','had','having','do','does','did','doing','will','would','should','could','may','might','must','can','in','on','at','to','for','of','with','by','from','about','as','into','through','and','or','but','nor','so','yet','if','all','any','each','every','both','few','many','more','most','some','no','not','only','own','other','same','very','than','too','just','also','even','dont','didnt','doesnt','wasnt','werent','havent','hasnt','hadnt','wont','wouldnt','shouldnt','couldnt','cant','cannot']);
    
    const words = text.toLowerCase().replace(/'s\b/g, '').replace(/n't\b/g, ' not').replace(/[^\w\s]/g, ' ').split(/\s+/)
      .filter(w => w.length > 3 && w.length < 20 && !stopWords.has(w) && !/^\d+$/.test(w) && /^[a-z]/.test(w));
    
    const freq = {};
    words.forEach(w => freq[w] = (freq[w] || 0) + 1);
    
    return [...new Set(Object.entries(freq).sort((a,b) => b[1]-a[1]).slice(0,8).map(([w]) => w))].slice(0,8);
  };

  const processBatchWithAI = async () => {
    setProcessing(true);
    const batchSize = 15;
    const batches = [];
    for (let i = 0; i < quotes.length; i += batchSize) batches.push(quotes.slice(i, i + batchSize));
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      setCurrentProcessing(batchIndex + 1);
      
      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 2000,
            messages: [{ role: 'user', content: `Generate filenames and tags for these quotes from "${metadata.title}". ${batch.map((q,i) => `Quote ${i+1}: "${q.text}"`).join(' ')} Respond with JSON array: [{"quote_number":1,"filename":"phrase","tags":["tag1","tag2"]}]` }]
          })
        });

        const data = await response.json();
        const text = data.content.find(c => c.type === 'text')?.text || '';
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        
        if (jsonMatch) {
          const results = JSON.parse(jsonMatch[0]);
          setQuotes(prev => {
            const updated = [...prev];
            results.forEach((r, i) => {
              const idx = batchIndex * batchSize + i;
              if (updated[idx]) {
                updated[idx] = { ...updated[idx], filename: r.filename || slugify(batch[i].text.substring(0,50)), suggestedTags: r.tags || [], tags: r.tags || [] };
              }
            });
            return updated;
          });
        }
      } catch (error) {
        console.error('Batch failed:', error);
      }
    }
    setProcessing(false);
  };

  const processIndividualWithAI = async () => {
    setProcessing(true);
    for (let i = 0; i < quotes.length; i++) {
      setCurrentProcessing(i + 1);
      await processQuoteWithAI(i);
    }
    setProcessing(false);
  };

  const processQuoteWithAI = async (index) => {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{ role: 'user', content: `Generate filename and tags for: "${quotes[index].text}". Respond with JSON: {"filename":"phrase","tags":["tag1","tag2"]}` }]
        })
      });

      const data = await response.json();
      const text = data.content.find(c => c.type === 'text')?.text || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        setQuotes(prev => {
          const updated = [...prev];
          updated[index] = { ...updated[index], filename: result.filename || '', suggestedTags: result.tags || [], tags: result.tags || [] };
          return updated;
        });
      }
    } catch (error) {
      console.error('AI failed:', error);
    }
  };

  const updateQuote = (index, field, value) => {
    setQuotes(prev => { const u = [...prev]; u[index] = {...u[index], [field]: value}; return u; });
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
    const authorSlugs = metadata.authors.map(a => slugify(a));
    const sourceSlug = slugify(metadata.title);

    metadata.authors.forEach((author, i) => {
      files.push({ name: `${authorSlugs[i]}.md`, content: `---\nnote-type: author\n---\n\n${i === 0 && metadata.authorBio ? metadata.authorBio : 'A short bio can go here.'}` });
    });

    const authorLinks = authorSlugs.map(s => `"[[${s}]]"`).join(', ');
    files.push({ name: `${sourceSlug}.md`, content: `---\nnote-type: source\n${metadata.tags.length > 0 ? `tags:\n${metadata.tags.map(t => `  - ${t}`).join('\n')}\n` : ''}author: [${authorLinks}]\nyear: ${metadata.year}\npublisher: ${metadata.publisher}\nformat: ${metadata.format}\nlink: "${metadata.link}"\ncitation: "${metadata.citation}"\n---\n\n# ${metadata.title}\n\nSummary goes here.` });

    quotes.forEach(quote => {
      const fn = quote.filename || slugify(quote.text.substring(0, 50));
      const tags = quote.tags.length > 0 ? `tags:\n${quote.tags.map(t => `  - ${t}`).join('\n')}\n` : 'tags:\n  -\n';
      files.push({ name: `${fn}.md`, content: `---\nnote-type: quote\nsource: "[[${sourceSlug}]]"\nauthor: [${authorLinks}]\n${tags}page: ${quote.page}\n---\n\n> ${quote.text}` });
    });

    return files;
  };

  const downloadFiles = async () => {
    const files = generateMarkdownFiles();
    try {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      await new Promise((resolve, reject) => { script.onload = resolve; script.onerror = reject; document.head.appendChild(script); });
      
      const zip = new window.JSZip();
      files.forEach(file => zip.file(file.name, file.content));
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${slugify(metadata.title)}-highlights.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      alert('Download complete!');
    } catch (error) {
      alert('Download failed: ' + error.message);
    }
  };

  const getAiModeInfo = () => {
    const modes = {
      none: { title: 'No AI', cost: 'Free' },
      low: { title: 'Smart AI', cost: `~${Math.ceil(quotes.length / 15)} API calls` },
      full: { title: 'Premium AI', cost: `${quotes.length} API calls` }
    };
    return modes[aiMode];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50">
      <header className="bg-gradient-to-r from-amber-900 to-red-900 text-amber-50 py-8 shadow-lg">
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex items-center gap-3 mb-2">
            <BookOpen className="w-8 h-8" />
            <h1 className="text-4xl font-serif font-bold">Scribsidian</h1>
          </div>
          <p className="text-amber-100 text-sm">Transform Kindle highlights into Obsidian notes</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="flex items-center justify-center gap-4 mb-12">
          {[1, 2, 3].map(num => (
            <div key={num} className="flex items-center gap-2">
              <button onClick={() => num < step && setStep(num)} disabled={num >= step}
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${step >= num ? 'bg-amber-800 text-white shadow-md' : 'bg-amber-200 text-amber-700'} ${num < step ? 'cursor-pointer hover:bg-amber-700' : 'cursor-default'}`}>
                {step > num ? <CheckCircle className="w-5 h-5" /> : num}
              </button>
              {num < 3 && <div className={`w-16 h-1 ${step > num ? 'bg-amber-800' : 'bg-amber-200'}`} />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="bg-white rounded-lg shadow-xl p-8 border-2 border-amber-100">
            <h2 className="text-2xl font-serif font-bold text-amber-900 mb-4">Paste Your Kindle Highlights</h2>
            <p className="text-gray-600 mb-6">Copy and paste your highlights from the Kindle app or PDF.</p>
            <textarea value={highlightsText} onChange={(e) => setHighlightsText(e.target.value)}
              className="w-full h-96 p-4 border-2 border-amber-200 rounded-lg font-mono text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all"
              placeholder="Page 88 | Highlight&#10;What do you pay when you pay attention?..." />
            <button onClick={handleParseHighlights} disabled={!highlightsText.trim()}
              className="mt-6 w-full bg-gradient-to-r from-amber-800 to-red-800 text-white py-3 rounded-lg font-semibold hover:from-amber-900 hover:to-red-900 disabled:opacity-50 transition-all shadow-md">
              Parse Highlights
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-xl p-8 border-2 border-amber-100">
              <h2 className="text-2xl font-serif font-bold text-amber-900 mb-4">Source Metadata</h2>
              <p className="text-gray-600 mb-6">Found {quotes.length} quotes. Please provide source information.</p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Title *</label>
                  <input type="text" value={metadata.title} onChange={(e) => setMetadata({...metadata, title: e.target.value})}
                    className="w-full p-3 border-2 border-amber-200 rounded-lg focus:border-amber-500 focus:ring-2 focus:ring-amber-200" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Authors *</label>
                  <TagInput tags={metadata.authors}
                    onAddTag={(a) => setMetadata({...metadata, authors: [...metadata.authors, a]})}
                    onRemoveTag={(a) => setMetadata({...metadata, authors: metadata.authors.filter(x => x !== a)})}
                    placeholder="Add author name..." hideLabel={true} />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Author Bio</label>
                  <textarea value={metadata.authorBio} onChange={(e) => setMetadata({...metadata, authorBio: e.target.value})}
                    className="w-full p-3 border-2 border-amber-200 rounded-lg focus:border-amber-500 h-24" placeholder="A brief biography..." />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Year</label>
                    <input type="text" value={metadata.year} onChange={(e) => setMetadata({...metadata, year: e.target.value})}
                      className="w-full p-3 border-2 border-amber-200 rounded-lg focus:border-amber-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Publisher</label>
                    <input type="text" value={metadata.publisher} onChange={(e) => setMetadata({...metadata, publisher: e.target.value})}
                      className="w-full p-3 border-2 border-amber-200 rounded-lg focus:border-amber-500" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Format</label>
                  <select value={metadata.format} onChange={(e) => setMetadata({...metadata, format: e.target.value})}
                    className="w-full p-3 border-2 border-amber-200 rounded-lg focus:border-amber-500">
                    <option value="book">Book</option>
                    <option value="article">Article</option>
                    <option value="essay">Essay</option>
                    <option value="report">Report</option>
                    <option value="podcast">Podcast</option>
                    <option value="video">Video</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Link</label>
                  <input type="text" value={metadata.link} onChange={(e) => setMetadata({...metadata, link: e.target.value})}
                    className="w-full p-3 border-2 border-amber-200 rounded-lg focus:border-amber-500" />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Citation</label>
                  <input type="text" value={metadata.citation} onChange={(e) => setMetadata({...metadata, citation: e.target.value})}
                    className="w-full p-3 border-2 border-amber-200 rounded-lg focus:border-amber-500" placeholder="Williams, J. (2018)..." />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Source Tags</label>
                  <TagInput tags={metadata.tags}
                    onAddTag={(t) => setMetadata({...metadata, tags: [...metadata.tags, t]})}
                    onRemoveTag={(t) => setMetadata({...metadata, tags: metadata.tags.filter(x => x !== t)})} />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-xl p-8 border-2 border-amber-100">
              <h2 className="text-2xl font-serif font-bold text-amber-900 mb-4">Choose Processing Mode</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button onClick={() => setAiMode('none')}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${aiMode === 'none' ? 'border-amber-500 bg-amber-50 shadow-md' : 'border-gray-200 hover:border-amber-300'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <ZapOff className="w-5 h-5 text-gray-600" />
                    <h3 className="font-semibold">No AI</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">Auto-generate simple filenames</p>
                  <p className="text-xs font-semibold text-green-600">Free • Instant</p>
                </button>

                <button onClick={() => setAiMode('low')}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${aiMode === 'low' ? 'border-amber-500 bg-amber-50 shadow-md' : 'border-gray-200 hover:border-amber-300'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-5 h-5 text-amber-600" />
                    <h3 className="font-semibold">Smart AI</h3>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Recommended</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">Batch processing for quality & cost balance</p>
                  <p className="text-xs font-semibold text-amber-600">~{Math.ceil(quotes.length / 15)} API calls</p>
                </button>

                <button onClick={() => setAiMode('full')}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${aiMode === 'full' ? 'border-amber-500 bg-amber-50 shadow-md' : 'border-gray-200 hover:border-amber-300'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Rocket className="w-5 h-5 text-purple-600" />
                    <h3 className="font-semibold">Premium AI</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">Individual processing for maximum quality</p>
                  <p className="text-xs font-semibold text-purple-600">{quotes.length} API calls</p>
                </button>
              </div>
            </div>

            <div className="flex gap-4">
              <button onClick={() => setStep(1)}
                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-all">
                ← Back
              </button>
              <button onClick={handleMetadataSubmit} disabled={!metadata.title || metadata.authors.length === 0}
                className="flex-1 bg-gradient-to-r from-amber-800 to-red-800 text-white py-3 rounded-lg font-semibold hover:from-amber-900 hover:to-red-900 disabled:opacity-50 transition-all shadow-md">
                {aiMode === 'none' ? 'Generate Files' : `Process with ${getAiModeInfo().title}`}
                {aiMode !== 'none' && <Sparkles className="inline w-4 h-4 ml-2" />}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            {processing && (
              <div className="bg-white rounded-lg shadow-xl p-8 border-2 border-amber-100 text-center">
                <Sparkles className="w-12 h-12 text-amber-600 mx-auto mb-4 animate-pulse" />
                <h3 className="text-xl font-semibold text-gray-800 mb-2">Processing with AI...</h3>
                <p className="text-gray-600">{aiMode === 'low' ? `Batch ${currentProcessing} of ${Math.ceil(quotes.length / 15)}` : `Quote ${currentProcessing} of ${quotes.length}`}</p>
              </div>
            )}
            
            {!processing && (
              <>
                <div className="bg-white rounded-lg shadow-xl p-6 border-2 border-amber-100">
                  <h2 className="text-2xl font-serif font-bold text-amber-900 mb-2">Review Your Quotes</h2>
                  <p className="text-gray-600">{aiMode === 'none' ? 'Filenames auto-generated. Edit as needed before downloading.' : 'AI has generated filenames and tags. Edit as needed before downloading.'}</p>
                </div>

                {quotes.map((quote, index) => (
                  <QuoteCard key={index} quote={quote} index={index} updateQuote={updateQuote} addTag={addTag} removeTag={removeTag} />
                ))}

                <div className="flex gap-4">
                  <button onClick={() => setStep(2)}
                    className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-all">
                    ← Back
                  </button>
                  <button onClick={downloadFiles}
                    className="flex-1 bg-gradient-to-r from-amber-800 to-red-800 text-white py-3 rounded-lg font-semibold hover:from-amber-900 hover:to-red-900 transition-all shadow-md">
                    <Download className="inline w-4 h-4 mr-2" />
                    Download ZIP
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </main>

      <footer className="max-w-4xl mx-auto px-6 py-6">
        <div className="flex items-center justify-center gap-3 text-sm">
          <label className="flex items-center gap-2 cursor-pointer text-gray-600 hover:text-amber-700 transition-colors">
            <input type="checkbox" checked={testMode} onChange={(e) => e.target.checked ? loadTestData() : setTestMode(false)}
              className="w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500" />
            <span className="font-medium">Test Mode</span>
            {testMode && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Active</span>}
          </label>
        </div>
      </footer>
    </div>
  );
};

const QuoteCard = ({ quote, index, updateQuote, addTag, removeTag }) => {
  const [editing, setEditing] = useState(false);

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-amber-100 hover:border-amber-300 transition-all">
      <div className="flex items-start justify-between mb-4">
        <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-3 py-1 rounded-full">Page {quote.page}</span>
      </div>
      <blockquote className="text-gray-700 italic mb-6 pl-4 border-l-4 border-amber-300">{quote.text}</blockquote>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Filename
            <button onClick={() => setEditing(!editing)} className="ml-2 text-amber-600 hover:text-amber-800">
              <Edit2 className="inline w-3 h-3" />
            </button>
          </label>
          {editing ? (
            <input type="text" value={quote.filename} onChange={(e) => updateQuote(index, 'filename', e.target.value)}
              onBlur={() => setEditing(false)} className="w-full p-2 border-2 border-amber-200 rounded-lg text-sm font-mono focus:border-amber-500" autoFocus />
          ) : (
            <div className="p-2 bg-gray-50 rounded-lg text-sm font-mono text-gray-800">{quote.filename || 'unnamed'}.md</div>
          )}
        </div>
        <TagInput tags={quote.tags} suggestedTags={quote.suggestedTags} onAddTag={(tag) => addTag(index, tag)} onRemoveTag={(tag) => removeTag(index, tag)} />
      </div>
    </div>
  );
};

const TagInput = ({ tags, suggestedTags = [], onAddTag, onRemoveTag, placeholder = "Add tag...", hideLabel = false }) => {
  const [newTag, setNewTag] = useState('');

  return (
    <div>
      {!hideLabel && <label className="block text-sm font-semibold text-gray-700 mb-2">Tags</label>}
      <div className="flex flex-wrap gap-2 mb-2">
        {tags.map((tag, i) => (
          <span key={i} className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-sm">
            {tag}
            <button onClick={() => onRemoveTag(tag)} className="hover:text-amber-900"><X className="w-3 h-3" /></button>
          </span>
        ))}
      </div>
      {suggestedTags && suggestedTags.length > 0 && (
        <div className="mb-2">
          <p className="text-xs text-gray-500 mb-1">Suggested:</p>
          <div className="flex flex-wrap gap-2">
            {suggestedTags.filter(tag => !tags.includes(tag)).map((tag, i) => (
              <button key={i} onClick={() => onAddTag(tag)}
                className="inline-flex items-center gap-1 bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm hover:bg-amber-50 hover:text-amber-700 transition-colors">
                <Plus className="w-3 h-3" />{tag}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <input type="text" value={newTag} onChange={(e) => setNewTag(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && newTag.trim() && (onAddTag(newTag), setNewTag(''))}
          placeholder={placeholder} className="flex-1 p-2 border-2 border-amber-200 rounded-lg text-sm focus:border-amber-500" />
        <button onClick={() => newTag.trim() && (onAddTag(newTag), setNewTag(''))}
          className="bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition-all">
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default ScribsidianApp;