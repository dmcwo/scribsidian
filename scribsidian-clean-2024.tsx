import React, { useState } from 'react';
import { BookOpen, Download, Sparkles, CheckCircle, Edit2, Plus, X, Zap, ZapOff, Rocket } from 'lucide-react';

const ScribsidianApp = () => {
  const [step, setStep] = useState(1);
  const [highlightsText, setHighlightsText] = useState('');
  const [metadata, setMetadata] = useState({
    title: '', authors: [], authorBio: '', year: '', publisher: '',
    link: '', citation: '', tags: [], format: 'book'
  });
  const [quotes, setQuotes] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [currentProcessing, setCurrentProcessing] = useState(0);
  const [aiMode, setAiMode] = useState('low');
  const [testMode, setTestMode] = useState(false);
  const [tagInventory, setTagInventory] = useState(null);
  const [buildingInventory, setBuildingInventory] = useState(false);

  const loadTestData = () => {
    setHighlightsText(`Page 88 | Highlight
What do you pay when you pay attention? You pay with all the things you could have attended to, but didn't: all the goals you didn't pursue, all the actions you didn't take, and all the possible yous you could have been, had you attended to those other things. Attention is paid in possible futures forgone.

Page 92 | Highlight
The liberation of human attention may be the defining moral and political struggle of our time.

Page 15 | Highlight
What we do with our attention matters more than we think, because our attention is all we really have.`);

    setMetadata({
      title: 'Stand Out of Our Light', authors: ['James Williams'],
      authorBio: 'James Wilson Williams (born 1982) is an American writer and academic. He was the winner of the inaugural Nine Dots Prize, in 2017.',
      year: '2018', publisher: 'Cambridge University Press',
      link: 'https://doi.org/10.1017/9781108453004',
      citation: 'Williams, J. (2018). Stand Out of Our Light. Cambridge University Press.',
      tags: ['attention-economy', 'digital-ethics', 'philosophy'], format: 'book'
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
    if (aiMode === 'none') {
      // Skip tag inventory for No AI mode
      setQuotes(prev => prev.map(quote => ({
        ...quote, filename: slugify(quote.text.substring(0, 50)), tags: [], suggestedTags: []
      })));
      setStep(3);
    } else {
      // Go to tag inventory step for Smart/Premium AI
      await buildTagInventory();
    }
  };

  const buildTagInventory = async () => {
    setBuildingInventory(true);
    setStep(2.5); // Intermediate step
    
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 3000,
          messages: [{
            role: 'user',
            content: `You are building a scholarly tag inventory for "${metadata.title}" by ${metadata.authors.join(', ')}.

Analyze these ${quotes.length} quotes and create a comprehensive tag taxonomy:

${quotes.map((q, i) => `QUOTE ${i + 1}:
"${q.text}"`).join('\n\n')}

SOURCE TAGS (must include): ${metadata.tags.join(', ')}

Create a tag inventory with:
1. Core Concepts: High-frequency, central theoretical concepts (5-8 tags)
2. Special Topics: Focused, specialized concepts (8-12 tags)
3. Outliers: Rare but semantically distinct concepts (3-5 tags)

RULES:
- Use hyphens (-) not underscores (_)
- 4-8 scholarly tags as lowercase hyphenated phrases
- Focus on: theoretical concepts, methodologies, themes, academic disciplines
- Extract parent disciplines from compound tags (e.g., "behavioral-psychology" → also include "psychology")
- Keep most legible phrases, prefer discipline-recognizable terms
- Allow rare tags if semantically distinct
- MUST include all source tags: ${metadata.tags.join(', ')}

Respond ONLY with JSON:
{
  "coreConcepts": ["attention", "ethics", "technology"],
  "specialTopics": ["attention-economy", "digital-ethics", "persuasion-technology"],
  "outliers": ["phenomenology", "epistemology"],
  "hierarchicalRelationships": [
    {"parent": "psychology", "children": ["behavioral-psychology", "cognitive-psychology"]}
  ]
}`
          }]
        })
      });

      const data = await response.json();
      const text = data.content.find(c => c.type === 'text')?.text || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const results = JSON.parse(jsonMatch[0]);
        
        // Normalize all tags to use hyphens
        const normalizeTag = (tag) => tag.replace(/_/g, '-');
        results.coreConcepts = results.coreConcepts.map(normalizeTag);
        results.specialTopics = results.specialTopics.map(normalizeTag);
        results.outliers = results.outliers.map(normalizeTag);
        
        // Extract all parent tags and add them to core concepts
        const parentTags = new Set();
        if (results.hierarchicalRelationships) {
          results.hierarchicalRelationships.forEach(rel => {
            parentTags.add(normalizeTag(rel.parent));
          });
        }
        
        // Add parent tags to core concepts if not already there
        parentTags.forEach(parent => {
          if (!results.coreConcepts.includes(parent)) {
            results.coreConcepts.push(parent);
          }
        });
        
        setTagInventory(results);
      }
    } catch (error) {
      console.error('Tag inventory failed:', error);
      alert('Failed to build tag inventory. Proceeding without it.');
      setStep(3);
    }
    
    setBuildingInventory(false);
  };

  const proceedWithTagInventory = async () => {
    setStep(3);
    if (aiMode === 'low') {
      await processBatchWithAI();
    } else {
      await processIndividualWithAI();
    }
  };

  const processBatchWithAI = async () => {
    setProcessing(true);
    const batchSize = 15;
    const batches = [];
    for (let i = 0; i < quotes.length; i += batchSize) batches.push(quotes.slice(i, i + batchSize));
    
    // Build available tags list from inventory
    const availableTags = tagInventory 
      ? [...tagInventory.coreConcepts, ...tagInventory.specialTopics, ...tagInventory.outliers]
      : [];
    
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
            messages: [{
              role: 'user',
              content: `You are helping organize academic highlights from "${metadata.title}" by ${metadata.authors.join(', ')}.

Generate concise filenames and select appropriate tags for these ${batch.length} quotes.

${tagInventory ? `AVAILABLE TAGS (select from this list):
${availableTags.join(', ')}
` : ''}

${batch.map((q, i) => `QUOTE ${i + 1} (Page ${q.page}):
"${q.text}"`).join('\n\n')}

FILENAME GUIDELINES:
- Create a short phrase (4-8 words) that captures the core claim/argument
- Use present tense, active voice when possible
- Should read naturally: "${metadata.authors[0]} argues that [your filename here]"
- Use HYPHENS to separate words (not underscores)
- Examples: "attention-is-paid-with-forgone-futures", "attention-liberation-prerequisite-for-all-struggles"

TAG GUIDELINES:
${tagInventory ? `- Select 3-6 tags from the available tags list that best match each quote
- You may create new tags if absolutely necessary (use hyphens)` : `- 5-8 scholarly tags as lowercase hyphenated phrases
- Focus on: theoretical concepts, methodologies, themes, disciplines`}

Respond ONLY with valid JSON array:
[{"quote_number":1,"filename":"phrase","tags":["tag1","tag2"]}]`
            }]
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
                updated[idx] = { 
                  ...updated[idx], 
                  filename: (r.filename || slugify(batch[i].text.substring(0,50))).replace(/_/g, '-'), 
                  suggestedTags: (r.tags || []).map(tag => tag.replace(/_/g, '-')), 
                  tags: (r.tags || []).map(tag => tag.replace(/_/g, '-'))
                };
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
    const quote = quotes[index];
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: `You are helping organize academic highlights from "${metadata.title}" by ${metadata.authors.join(', ')}.

Generate a concise filename and tags for this quote. The filename should work as a natural phrase you'd use when citing this idea in writing.

Quote: "${quote.text}"

FILENAME GUIDELINES:
- Create a short phrase (4-8 words) that captures the core claim/argument
- Use present tense, active voice when possible
- Should read naturally in a sentence like: "Williams argues that [your filename here]"
- Use HYPHENS to separate words (not underscores)
- Examples:
  * "attention-is-paid-with-forgone-futures"
  * "attention-liberation-prerequisite-for-all-struggles"
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
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        setQuotes(prev => {
          const updated = [...prev];
          updated[index] = { 
            ...updated[index], 
            filename: (result.filename || '').replace(/_/g, '-'), 
            suggestedTags: (result.tags || []).map(tag => tag.replace(/_/g, '-')), 
            tags: (result.tags || []).map(tag => tag.replace(/_/g, '-'))
          };
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
          {[1, 2, 2.5, 3].map(num => (
            <div key={num} className="flex items-center gap-2">
              <button onClick={() => num < step && setStep(num)} disabled={num >= step}
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${step >= num ? 'bg-amber-800 text-white shadow-md' : 'bg-amber-200 text-amber-700'} ${num < step ? 'cursor-pointer hover:bg-amber-700' : 'cursor-default'}`}>
                {step > num ? <CheckCircle className="w-5 h-5" /> : (num === 2.5 ? '📑' : Math.floor(num))}
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
              <p className="text-gray-600 mb-6">Found {quotes.length} quotes.</p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Title *</label>
                  <input type="text" value={metadata.title} onChange={(e) => setMetadata({...metadata, title: e.target.value})}
                    className="w-full p-3 border-2 border-amber-200 rounded-lg focus:border-amber-500" />
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
                    className="w-full p-3 border-2 border-amber-200 rounded-lg h-24" placeholder="Brief biography..." />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Year</label>
                    <input type="text" value={metadata.year} onChange={(e) => setMetadata({...metadata, year: e.target.value})}
                      className="w-full p-3 border-2 border-amber-200 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Publisher</label>
                    <input type="text" value={metadata.publisher} onChange={(e) => setMetadata({...metadata, publisher: e.target.value})}
                      className="w-full p-3 border-2 border-amber-200 rounded-lg" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Format</label>
                  <select value={metadata.format} onChange={(e) => setMetadata({...metadata, format: e.target.value})}
                    className="w-full p-3 border-2 border-amber-200 rounded-lg">
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
                    className="w-full p-3 border-2 border-amber-200 rounded-lg" />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Citation</label>
                  <input type="text" value={metadata.citation} onChange={(e) => setMetadata({...metadata, citation: e.target.value})}
                    className="w-full p-3 border-2 border-amber-200 rounded-lg" placeholder="Williams, J. (2018)..." />
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
                  className={`p-4 rounded-lg border-2 transition-all text-left ${aiMode === 'none' ? 'border-amber-500 bg-amber-50' : 'border-gray-200'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <ZapOff className="w-5 h-5" />
                    <h3 className="font-semibold">No AI</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">Auto-generate simple filenames</p>
                  <p className="text-xs font-semibold text-green-600">Free</p>
                </button>

                <button onClick={() => setAiMode('low')}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${aiMode === 'low' ? 'border-amber-500 bg-amber-50' : 'border-gray-200'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-5 h-5" />
                    <h3 className="font-semibold">Smart AI</h3>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Recommended</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">Batch processing</p>
                  <p className="text-xs font-semibold text-amber-600">~{Math.ceil(quotes.length / 15)} API calls</p>
                </button>

                <button onClick={() => setAiMode('full')}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${aiMode === 'full' ? 'border-amber-500 bg-amber-50' : 'border-gray-200'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Rocket className="w-5 h-5" />
                    <h3 className="font-semibold">Premium AI</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">Individual processing</p>
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
                {aiMode === 'none' ? 'Generate Files' : `Process with AI`}
                {aiMode !== 'none' && <Sparkles className="inline w-4 h-4 ml-2" />}
              </button>
            </div>
          </div>
        )}

        {step === 2.5 && (
          <div className="space-y-6">
            {buildingInventory && (
              <div className="bg-white rounded-lg shadow-xl p-8 border-2 border-amber-100 text-center">
                <Sparkles className="w-12 h-12 text-amber-600 mx-auto mb-4 animate-pulse" />
                <h3 className="text-xl font-semibold text-gray-800 mb-2">Building Tag Inventory...</h3>
                <p className="text-gray-600">Analyzing {quotes.length} quotes to create a scholarly tag taxonomy</p>
              </div>
            )}

            {!buildingInventory && tagInventory && (
              <>
                <div className="bg-white rounded-lg shadow-xl p-8 border-2 border-amber-100">
                  <h2 className="text-2xl font-serif font-bold text-amber-900 mb-4">Tag Inventory</h2>
                  <p className="text-gray-600 mb-6">
                    Review and refine the tag taxonomy. These tags will be used to organize your {quotes.length} quotes.
                  </p>

                  <div className="space-y-6">
                    <div>
                      <h3 className="font-semibold text-lg text-gray-900 mb-2">⭐ Core Concepts</h3>
                      <p className="text-sm text-gray-600 mb-3">Central theoretical concepts and disciplines</p>
                      <TagInput
                        tags={tagInventory.coreConcepts}
                        onAddTag={(tag) => setTagInventory({...tagInventory, coreConcepts: [...tagInventory.coreConcepts, tag]})}
                        onRemoveTag={(tag) => setTagInventory({...tagInventory, coreConcepts: tagInventory.coreConcepts.filter(t => t !== tag)})}
                        hideLabel={true}
                      />
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg text-gray-900 mb-2">🎯 Special Topics</h3>
                      <p className="text-sm text-gray-600 mb-3">Focused, specialized concepts</p>
                      <TagInput
                        tags={tagInventory.specialTopics}
                        onAddTag={(tag) => setTagInventory({...tagInventory, specialTopics: [...tagInventory.specialTopics, tag]})}
                        onRemoveTag={(tag) => setTagInventory({...tagInventory, specialTopics: tagInventory.specialTopics.filter(t => t !== tag)})}
                        hideLabel={true}
                      />
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg text-gray-900 mb-2">💎 Outliers</h3>
                      <p className="text-sm text-gray-600 mb-3">Rare but semantically distinct concepts</p>
                      <TagInput
                        tags={tagInventory.outliers}
                        onAddTag={(tag) => setTagInventory({...tagInventory, outliers: [...tagInventory.outliers, tag]})}
                        onRemoveTag={(tag) => setTagInventory({...tagInventory, outliers: tagInventory.outliers.filter(t => t !== tag)})}
                        hideLabel={true}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button onClick={() => setStep(2)}
                    className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-all">
                    ← Back
                  </button>
                  <button onClick={proceedWithTagInventory}
                    className="flex-1 bg-gradient-to-r from-amber-800 to-red-800 text-white py-3 rounded-lg font-semibold hover:from-amber-900 hover:to-red-900 transition-all shadow-md">
                    Continue to Quote Processing
                    <Sparkles className="inline w-4 h-4 ml-2" />
                  </button>
                </div>
              </>
            )}
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
                  <p className="text-gray-600">{aiMode === 'none' ? 'Filenames auto-generated. Edit as needed.' : 'AI has generated filenames and tags. Edit as needed.'}</p>
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
          <label className="flex items-center gap-2 cursor-pointer text-gray-600 hover:text-amber-700">
            <input type="checkbox" checked={testMode} onChange={(e) => e.target.checked ? loadTestData() : setTestMode(false)}
              className="w-4 h-4 text-amber-600 border-gray-300 rounded" />
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