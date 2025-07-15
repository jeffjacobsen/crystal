#!/usr/bin/env python3
import json
import sys
import asyncio
from urllib.parse import urljoin, urlparse, urldefrag
from typing import List, Dict, Set, Any
from crawl4ai import AsyncWebCrawler, CrawlerRunConfig, CacheMode
import os

# Suppress crawl4ai verbose output
os.environ['CRAWL4AI_VERBOSE'] = 'false'

def is_sitemap(url: str) -> bool:
    """Check if URL is a sitemap."""
    return url.endswith('sitemap.xml') or 'sitemap' in urlparse(url).path

def is_txt(url: str) -> bool:
    """Check if URL is a text file."""
    return url.endswith('.txt') or url.endswith('llms.txt') or url.endswith('llms-full.txt')

def normalize_url(url: str) -> str:
    """Normalize URL by removing fragments."""
    return urldefrag(url)[0]

def is_internal_link(base_url: str, link_url: str) -> bool:
    """Check if a link is internal to the base domain."""
    base_domain = urlparse(base_url).netloc
    link_domain = urlparse(link_url).netloc
    return base_domain == link_domain

async def parse_sitemap(url: str) -> List[str]:
    """Parse a sitemap and extract URLs."""
    try:
        import aiohttp
        import xml.etree.ElementTree as ET
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                if response.status == 200:
                    content = await response.text()
                    root = ET.fromstring(content)
                    
                    # Handle different sitemap formats
                    urls = []
                    for elem in root.iter():
                        if elem.tag.endswith('loc'):
                            urls.append(elem.text)
                    
                    return urls
    except Exception as e:
        print(json.dumps({"type": "error", "error": f"Failed to parse sitemap: {str(e)}"}))
        sys.stdout.flush()
    
    return []

async def crawl_single_page(crawler: AsyncWebCrawler, url: str) -> Dict[str, Any]:
    """Crawl a single page and return its content."""
    print(json.dumps({
        "type": "progress", 
        "status": "crawling", 
        "message": f"Fetching content from {url}",
        "currentUrl": url
    }))
    sys.stdout.flush()
    
    try:
        # Use minimal configuration to avoid compatibility issues
        result = await crawler.arun(url)
    except Exception as e:
        print(json.dumps({
            "type": "error",
            "error": f"Failed to crawl {url}: {str(e)}"
        }))
        sys.stdout.flush()
        return {
            'url': url,
            'success': False,
            'error': str(e)
        }
    
    if result.success:
        # Extract content
        content = result.markdown if hasattr(result, 'markdown') and result.markdown else ''
        
        # Try to get title from metadata or extract from content
        title = ''
        if hasattr(result, 'metadata') and result.metadata and 'title' in result.metadata:
            title = result.metadata.get('title', '')
        elif content:
            title = extract_title_from_content(content)
        
        # Extract links for potential recursive crawling
        links = []
        if hasattr(result, 'links') and result.links:
            for link in result.links:
                if isinstance(link, dict) and 'href' in link:
                    full_url = urljoin(url, link['href'])
                    links.append(full_url)
                elif isinstance(link, str):
                    full_url = urljoin(url, link)
                    links.append(full_url)
        
        # If we have HTML, try to extract links from it
        if hasattr(result, 'html') and result.html and not links:
            import re
            # Simple regex to find links
            href_pattern = r'href=[\'"]([^\'"]+)[\'"]'
            matches = re.findall(href_pattern, result.html)
            for match in matches:
                if match.startswith('http') or match.startswith('/'):
                    full_url = urljoin(url, match)
                    links.append(full_url)
        
        return {
            'url': url,
            'content': content,
            'title': title or 'Untitled',
            'links': links,
            'success': True
        }
    else:
        error_msg = 'Failed to crawl page'
        if hasattr(result, 'error'):
            error_msg = result.error
        elif hasattr(result, 'error_message'):
            error_msg = result.error_message
        
        return {
            'url': url,
            'success': False,
            'error': error_msg
        }

async def crawl_recursive(crawler: AsyncWebCrawler, start_url: str, options: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Recursively crawl starting from a URL."""
    max_depth = options.get('maxDepth', 3)
    max_pages = options.get('maxPages', 50)
    follow_internal_only = options.get('followInternalOnly', True)
    
    visited = set()
    to_visit = [(normalize_url(start_url), 0)]  # (url, depth)
    results = []
    pages_processed = 0
    
    while to_visit and pages_processed < max_pages:
        url, depth = to_visit.pop(0)
        
        if url in visited or depth > max_depth:
            continue
        
        visited.add(url)
        pages_processed += 1
        
        print(json.dumps({
            "type": "progress",
            "status": "crawling",
            "message": f"Processing page {pages_processed} of max {max_pages}",
            "currentUrl": url,
            "pagesProcessed": pages_processed,
            "totalPages": len(to_visit) + pages_processed,
            "depth": depth
        }))
        sys.stdout.flush()
        
        # Crawl the page
        page_result = await crawl_single_page(crawler, url)
        
        if page_result['success']:
            results.append({
                'url': page_result['url'],
                'title': page_result['title'],
                'content': page_result['content'],
                'depth': depth
            })
            
            # Add new links to visit
            if depth < max_depth and 'links' in page_result:
                for link in page_result['links']:
                    normalized_link = normalize_url(link)
                    
                    # Check if we should follow this link
                    if normalized_link not in visited:
                        if not follow_internal_only or is_internal_link(start_url, normalized_link):
                            to_visit.append((normalized_link, depth + 1))
    
    return results

async def scrape_url(url: str, mode: str = 'auto', options: Dict[str, Any] = None):
    """Main scraping function with mode support."""
    if options is None:
        options = {}
    
    try:
        print(json.dumps({"type": "progress", "status": "starting", "message": "Initializing crawler..."}))
        sys.stdout.flush()
        
        async with AsyncWebCrawler(verbose=False) as crawler:
            # Auto-detect mode if needed
            if mode == 'auto':
                if is_txt(url):
                    mode = 'single'
                elif is_sitemap(url):
                    mode = 'sitemap'
                else:
                    # For auto mode, use recursive for documentation sites
                    mode = 'recursive'
            
            results = []
            
            if mode == 'single':
                # Single page crawl
                result = await crawl_single_page(crawler, url)
                if result['success']:
                    results = [{
                        'url': result['url'],
                        'title': result['title'],
                        'content': result['content']
                    }]
            
            elif mode == 'sitemap':
                # Parse sitemap and crawl all URLs
                print(json.dumps({"type": "progress", "status": "processing", "message": "Parsing sitemap..."}))
                sys.stdout.flush()
                
                sitemap_urls = await parse_sitemap(url)
                if sitemap_urls:
                    for i, sitemap_url in enumerate(sitemap_urls[:options.get('maxPages', 50)]):
                        print(json.dumps({
                            "type": "progress",
                            "status": "crawling",
                            "message": f"Processing sitemap URL {i+1} of {len(sitemap_urls)}",
                            "currentUrl": sitemap_url,
                            "pagesProcessed": i + 1,
                            "totalPages": len(sitemap_urls)
                        }))
                        sys.stdout.flush()
                        
                        result = await crawl_single_page(crawler, sitemap_url)
                        if result['success']:
                            results.append({
                                'url': result['url'],
                                'title': result['title'],
                                'content': result['content']
                            })
            
            elif mode == 'recursive':
                # Recursive crawl
                results = await crawl_recursive(crawler, url, options)
            
            # Process results
            if not results:
                return {
                    "type": "error",
                    "error": "No content could be extracted from the URL"
                }
            
            # Combine results if multiple pages
            if len(results) == 1:
                # Single page result
                page = results[0]
                return {
                    "type": "result",
                    "success": True,
                    "title": page['title'],
                    "content": page['content'],
                    "excerpt": create_excerpt(page['content']),
                    "url": url,
                    "metadata": {
                        "pagesCount": 1,
                        "mode": mode
                    }
                }
            else:
                # Multiple pages - combine content
                combined_title = results[0]['title'] if results else "Combined Documentation"
                combined_content = ""
                
                for page in results:
                    page_header = f"\n\n## {page['title']}\n*Source: {page['url']}*\n\n"
                    combined_content += page_header + page['content']
                
                return {
                    "type": "result",
                    "success": True,
                    "title": combined_title,
                    "content": combined_content,
                    "excerpt": create_excerpt(combined_content),
                    "url": url,
                    "metadata": {
                        "pagesCount": len(results),
                        "mode": mode,
                        "pages": [{"url": r['url'], "title": r['title']} for r in results]
                    }
                }
            
    except Exception as e:
        return {"type": "error", "error": str(e)}

def extract_title_from_content(content):
    """Extract title from markdown content."""
    lines = content.split('\n')
    for line in lines:
        if line.strip().startswith('# '):
            return line.strip()[2:].strip()
    return "Untitled Document"

def create_excerpt(content, max_length=300):
    """Create an excerpt from content."""
    # Remove markdown formatting
    text = content
    for pattern in ['#', '*', '_', '`', '[', ']', '(', ')', '>', '|']:
        text = text.replace(pattern, '')
    
    # Clean up whitespace
    text = ' '.join(text.split())
    
    if len(text) <= max_length:
        return text
    
    return text[:max_length].rsplit(' ', 1)[0] + '...'

def extract_code_blocks(content):
    """Extract code blocks from markdown content."""
    import re
    code_blocks = []
    
    # Match code blocks with optional language
    pattern = r'```(?:[a-zA-Z]+)?\n(.*?)\n```'
    matches = re.findall(pattern, content, re.DOTALL)
    
    for match in matches:
        code_blocks.append(match.strip())
    
    return code_blocks

async def main():
    if len(sys.argv) < 2:
        print(json.dumps({"type": "error", "error": "URL argument required"}))
        sys.exit(1)
    
    url = sys.argv[1]
    
    # Parse additional arguments as JSON options
    options = {}
    if len(sys.argv) > 2:
        try:
            options = json.loads(sys.argv[2])
        except:
            options = {}
    
    mode = options.pop('mode', 'auto')
    result = await scrape_url(url, mode, options)
    print(json.dumps(result))

if __name__ == "__main__":
    asyncio.run(main())