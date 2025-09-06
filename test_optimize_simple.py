#!/usr/bin/env python3
"""
Simplified optimized version of golf article processor
Focus on core improvements: async processing, better parsing, error handling
"""

import asyncio
import aiohttp
from bs4 import BeautifulSoup
from typing import List, Dict, Optional
from dataclasses import dataclass
import logging
import time

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class Article:
    """Simple article data class"""
    url: str
    title: Optional[str] = None
    body: Optional[str] = None
    success: bool = False
    error: Optional[str] = None
    processing_time: float = 0.0


class SimpleGolfProcessor:
    """Simplified golf article processor with async support"""
    
    def __init__(self, max_concurrent: int = 5, timeout: int = 30):
        self.max_concurrent = max_concurrent
        self.timeout = aiohttp.ClientTimeout(total=timeout)
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    
    async def extract_content(self, html: str) -> Dict[str, Optional[str]]:
        """Extract title and body from HTML using BeautifulSoup"""
        soup = BeautifulSoup(html, 'html.parser')
        
        # Remove unwanted elements
        for element in soup(['script', 'style', 'nav', 'header', 'footer']):
            element.decompose()
        
        # Extract title - try multiple methods
        title = None
        for selector in ['h1', 'meta[property="og:title"]', 'title']:
            element = soup.select_one(selector)
            if element:
                if element.name == 'meta':
                    title = element.get('content', '')
                else:
                    title = element.get_text(strip=True)
                if title:
                    break
        
        # Extract body - look for article content
        body = None
        for selector in ['article', 'div.article-content', 'main', 'div.content']:
            content = soup.select_one(selector)
            if content:
                body = content.get_text(separator='\n', strip=True)
                if len(body) > 100:  # Ensure meaningful content
                    break
        
        # Fallback to all paragraphs
        if not body:
            paragraphs = soup.find_all('p')
            if paragraphs:
                body = '\n'.join(p.get_text(strip=True) for p in paragraphs)
        
        return {'title': title, 'body': body}
    
    async def process_url(self, session: aiohttp.ClientSession, url: str) -> Article:
        """Process a single URL"""
        start_time = time.time()
        article = Article(url=url)
        
        try:
            async with session.get(url, headers=self.headers) as response:
                if response.status == 200:
                    html = await response.text()
                    content = await self.extract_content(html)
                    
                    article.title = content['title']
                    article.body = content['body']
                    article.success = bool(article.title and article.body)
                    
                    if not article.success:
                        article.error = "Missing title or body content"
                else:
                    article.error = f"HTTP {response.status}"
                    
        except asyncio.TimeoutError:
            article.error = "Timeout"
        except Exception as e:
            article.error = str(e)
            logger.error(f"Error processing {url}: {e}")
        
        article.processing_time = time.time() - start_time
        return article
    
    async def process_articles(self, urls: List[str]) -> List[Article]:
        """Process multiple articles concurrently"""
        logger.info(f"Processing {len(urls)} articles with {self.max_concurrent} workers")
        
        # Create session and semaphore for concurrency control
        async with aiohttp.ClientSession(timeout=self.timeout) as session:
            semaphore = asyncio.Semaphore(self.max_concurrent)
            
            async def process_with_limit(url: str) -> Article:
                async with semaphore:
                    return await self.process_url(session, url)
            
            # Process all URLs concurrently
            results = await asyncio.gather(
                *[process_with_limit(url) for url in urls],
                return_exceptions=True
            )
            
            # Handle exceptions
            articles = []
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    article = Article(url=urls[i], error=str(result))
                else:
                    article = result
                
                # Log progress
                status = "✅" if article.success else "❌"
                logger.info(f"{status} {article.url} ({article.processing_time:.2f}s)")
                articles.append(article)
            
            return articles
    
    def get_summary(self, articles: List[Article]) -> Dict[str, any]:
        """Get processing summary statistics"""
        total = len(articles)
        successful = sum(1 for a in articles if a.success)
        failed = total - successful
        avg_time = sum(a.processing_time for a in articles) / total if total > 0 else 0
        
        return {
            'total': total,
            'successful': successful,
            'failed': failed,
            'success_rate': successful / total if total > 0 else 0,
            'avg_processing_time': avg_time
        }


async def main():
    """Example usage"""
    # Test URLs
    urls = [
        'https://www.golf.com/news/',
        'https://www.golfdigest.com/',
        'https://www.golfmonthly.com/',
        # Add more URLs here
    ]
    
    # Create processor and process articles
    processor = SimpleGolfProcessor(max_concurrent=5, timeout=30)
    results = await processor.process_articles(urls)
    
    # Print summary
    summary = processor.get_summary(results)
    print(f"\nProcessing Summary:")
    print(f"Total: {summary['total']}")
    print(f"Successful: {summary['successful']}")
    print(f"Failed: {summary['failed']}")
    print(f"Success Rate: {summary['success_rate']:.1%}")
    print(f"Avg Time: {summary['avg_processing_time']:.2f}s")
    
    # Print successful articles
    print("\nSuccessful Articles:")
    for article in results:
        if article.success:
            print(f"- {article.title}")
            print(f"  URL: {article.url}")
            print(f"  Content: {len(article.body)} characters")


if __name__ == '__main__':
    # Run the async main function
    asyncio.run(main())