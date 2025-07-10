#!/usr/bin/env node

const https = require('https');
const fs = require('fs');

function fetchFeed(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        return;
      }
      
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function parseAtomFeed(xml) {
  if (!xml || !xml.includes('<entry>')) {
    throw new Error('Invalid XML feed: no entries found');
  }
  
  const entries = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  const titleRegex = /<title[^>]*>(.*?)<\/title>/s;
  const linkRegex = /<link[^>]*href="([^"]+)"/;
  
  function cleanCDATA(text) {
    return text.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1');
  }
  
  let match;
  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1];
    const titleMatch = titleRegex.exec(entry);
    const linkMatch = linkRegex.exec(entry);
    
    if (titleMatch && linkMatch) {
      entries.push({
        title: cleanCDATA(titleMatch[1].trim()),
        link: cleanCDATA(linkMatch[1].trim())
      });
    }
  }
  
  return entries.slice(0, 6);
}

async function updateReadme() {
  try {
    const feedXml = await fetchFeed('https://gofranz.com/feed.xml');
    const entries = parseAtomFeed(feedXml);
    
    const readme = fs.readFileSync('README.md', 'utf8');
    const lines = readme.split('\n');
    
    const blogSectionIndex = lines.findIndex(line => line.includes('#### From My Blog'));
    if (blogSectionIndex === -1) {
      console.error('Could not find "#### From My Blog" section');
      return;
    }
    
    const nextSectionIndex = lines.findIndex((line, index) => 
      index > blogSectionIndex && line.startsWith('####')
    );
    
    const continueReadingIndex = lines.findIndex((line, index) => 
      index > blogSectionIndex && line.includes('Continue reading:')
    );
    
    const blogLinks = entries.map(entry => `- [${entry.title}](${entry.link})`);
    
    const endOfBlogSection = continueReadingIndex !== -1 ? continueReadingIndex : nextSectionIndex;
    
    const newLines = [
      ...lines.slice(0, blogSectionIndex + 1),
      '',
      ...blogLinks,
      '',
      ...lines.slice(endOfBlogSection)
    ];
    
    fs.writeFileSync('README.md', newLines.join('\n'));
    console.log('Successfully updated README.md with latest blog posts');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

updateReadme();