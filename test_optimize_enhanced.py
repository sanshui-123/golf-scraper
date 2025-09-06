#!/usr/bin/env python3
"""
Enhanced Golf Article Processor with async/await, better error handling,
advanced HTML parsing, and modern Python features.
"""

import asyncio
import aiohttp
from aiohttp import ClientSession, ClientTimeout, TCPConnector
from bs4 import BeautifulSoup
from typing import List, Dict, Optional, Tuple, Any
from dataclasses import dataclass, field
from enum import Enum
import logging
from datetime import datetime
import json
from pathlib import Path
from urllib.parse import urlparse
import backoff
from functools import wraps
import time
from contextlib import asynccontextmanager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class ProcessingStatus(Enum):
    """Enum for article processing status"""
    SUCCESS = "success"
    FAILED = "failed"
    TIMEOUT = "timeout"
    RETRY_EXHAUSTED = "retry_exhausted"
    INVALID_CONTENT = "invalid_content"


@dataclass
class ArticleMetadata:
    """Data class for article metadata"""
    author: Optional[str] = None
    published_date: Optional[str] = None
    tags: List[str] = field(default_factory=list)
    word_count: int = 0
    images: List[str] = field(default_factory=list)


@dataclass
class ProcessedArticle:
    """Data class for processed article results"""
    url: str
    title: Optional[str] = None
    body: Optional[str] = None
    summary: Optional[str] = None
    metadata: Optional[ArticleMetadata] = None
    status: ProcessingStatus = ProcessingStatus.FAILED
    error: Optional[str] = None
    processing_time: float = 0.0
    retry_count: int = 0


class RateLimiter:
    """Simple rate limiter for API requests"""
    def __init__(self, max_requests: int = 10, time_window: int = 1):
        self.max_requests = max_requests
        self.time_window = time_window
        self.requests = []
        self._lock = asyncio.Lock()
    
    async def acquire(self):
        async with self._lock:
            now = time.time()
            # Remove old requests outside the time window
            self.requests = [req_time for req_time in self.requests 
                           if now - req_time < self.time_window]
            
            if len(self.requests) >= self.max_requests:
                sleep_time = self.time_window - (now - self.requests[0])
                await asyncio.sleep(sleep_time)
                return await self.acquire()
            
            self.requests.append(now)


class HTMLParser:
    """Advanced HTML parser using BeautifulSoup"""
    
    @staticmethod
    def extract_title(soup: BeautifulSoup) -> Optional[str]:
        """Extract article title with multiple strategies"""
        # Try multiple selectors in order of preference
        selectors = [
            'h1.article-title',
            'h1.entry-title',
            'h1[itemprop="headline"]',
            'meta[property="og:title"]',
            'meta[name="twitter:title"]',
            'title'
        ]
        
        for selector in selectors:
            element = soup.select_one(selector)
            if element:
                if element.name == 'meta':
                    return element.get('content', '').strip()
                return element.get_text(strip=True)
        
        return None
    
    @staticmethod
    def extract_body(soup: BeautifulSoup) -> Optional[str]:
        """Extract article body with intelligent content detection"""
        # Remove script and style elements
        for script in soup(['script', 'style', 'nav', 'header', 'footer']):
            script.decompose()
        
        # Try multiple content selectors
        content_selectors = [
            'article',
            'div.article-content',
            'div.entry-content',
            'div.post-content',
            'main',
            'div[itemprop="articleBody"]'
        ]
        
        for selector in content_selectors:
            content = soup.select_one(selector)
            if content:
                # Extract text and clean up
                text = content.get_text(separator='\n', strip=True)
                # Remove excessive newlines
                text = '\n'.join(line.strip() for line in text.split('\n') 
                               if line.strip())
                if len(text) > 100:  # Minimum content length
                    return text
        
        # Fallback: get all paragraphs
        paragraphs = soup.find_all('p')
        if paragraphs:
            text = '\n'.join(p.get_text(strip=True) for p in paragraphs 
                           if p.get_text(strip=True))
            if len(text) > 100:
                return text
        
        return None
    
    @staticmethod
    def extract_summary(body: Optional[str], max_length: int = 300) -> Optional[str]:
        """Generate article summary from body text"""
        if not body:
            return None
        
        # Take first few sentences
        sentences = body.split('. ')
        summary = ''
        
        for sentence in sentences:
            if len(summary) + len(sentence) < max_length:
                summary += sentence + '. '
            else:
                break
        
        return summary.strip()
    
    @staticmethod
    def extract_metadata(soup: BeautifulSoup) -> ArticleMetadata:
        """Extract article metadata"""
        metadata = ArticleMetadata()
        
        # Extract author
        author_selectors = [
            'meta[name="author"]',
            'span.by-author',
            'span.author-name',
            'a[rel="author"]'
        ]
        
        for selector in author_selectors:
            element = soup.select_one(selector)
            if element:
                if element.name == 'meta':
                    metadata.author = element.get('content', '').strip()
                else:
                    metadata.author = element.get_text(strip=True)
                break
        
        # Extract published date
        date_selectors = [
            'meta[property="article:published_time"]',
            'time[datetime]',
            'span.published-date'
        ]
        
        for selector in date_selectors:
            element = soup.select_one(selector)
            if element:
                if element.name == 'meta':
                    metadata.published_date = element.get('content', '').strip()
                elif element.name == 'time':
                    metadata.published_date = element.get('datetime', '').strip()
                else:
                    metadata.published_date = element.get_text(strip=True)
                break
        
        # Extract tags
        tag_elements = soup.select('a[rel="tag"], meta[property="article:tag"]')
        for element in tag_elements:
            if element.name == 'meta':
                tag = element.get('content', '').strip()
            else:
                tag = element.get_text(strip=True)
            if tag:
                metadata.tags.append(tag)
        
        # Extract images
        img_elements = soup.select('article img, div.article-content img')
        for img in img_elements:
            src = img.get('src', '')
            if src and not src.startswith('data:'):
                metadata.images.append(src)
        
        return metadata


class GolfArticleProcessor:
    """Main processor class for golf articles"""
    
    def __init__(self, 
                 max_concurrent: int = 10,
                 timeout: int = 30,
                 max_retries: int = 3,
                 rate_limit: int = 20):
        self.max_concurrent = max_concurrent
        self.timeout = ClientTimeout(total=timeout)
        self.max_retries = max_retries
        self.rate_limiter = RateLimiter(max_requests=rate_limit)
        self.session: Optional[ClientSession] = None
        self.parser = HTMLParser()
        self._stats = {
            'total_processed': 0,
            'successful': 0,
            'failed': 0,
            'total_time': 0.0
        }
    
    @asynccontextmanager
    async def _get_session(self):
        """Context manager for aiohttp session"""
        if self.session is None:
            connector = TCPConnector(limit=self.max_concurrent)
            self.session = ClientSession(
                timeout=self.timeout,
                connector=connector,
                headers={
                    'User-Agent': 'Mozilla/5.0 (compatible; GolfArticleBot/1.0)'
                }
            )
        try:
            yield self.session
        finally:
            # Session cleanup is handled in __aexit__
            pass
    
    @backoff.on_exception(
        backoff.expo,
        (aiohttp.ClientError, asyncio.TimeoutError),
        max_tries=3,
        max_time=60
    )
    async def _fetch_url(self, session: ClientSession, url: str) -> Tuple[str, int]:
        """Fetch URL with exponential backoff retry"""
        await self.rate_limiter.acquire()
        
        async with session.get(url) as response:
            content = await response.text()
            return content, response.status
    
    async def process_single_article(self, url: str) -> ProcessedArticle:
        """Process a single article URL"""
        start_time = time.time()
        article = ProcessedArticle(url=url)
        
        try:
            async with self._get_session() as session:
                content, status = await self._fetch_url(session, url)
                
                if status != 200:
                    article.status = ProcessingStatus.FAILED
                    article.error = f"HTTP {status}"
                    return article
                
                # Parse HTML
                soup = BeautifulSoup(content, 'html.parser')
                
                # Extract components
                article.title = self.parser.extract_title(soup)
                article.body = self.parser.extract_body(soup)
                article.summary = self.parser.extract_summary(article.body)
                article.metadata = self.parser.extract_metadata(soup)
                
                # Validate content
                if not article.title or not article.body:
                    article.status = ProcessingStatus.INVALID_CONTENT
                    article.error = "Missing title or body content"
                else:
                    article.status = ProcessingStatus.SUCCESS
                    if article.metadata and article.body:
                        article.metadata.word_count = len(article.body.split())
                
        except asyncio.TimeoutError:
            article.status = ProcessingStatus.TIMEOUT
            article.error = "Request timeout"
        except Exception as e:
            article.status = ProcessingStatus.FAILED
            article.error = str(e)
            logger.exception(f"Error processing {url}")
        finally:
            article.processing_time = time.time() - start_time
        
        return article
    
    async def process_articles(self, 
                             urls: List[str], 
                             progress_callback: Optional[callable] = None) -> List[ProcessedArticle]:
        """Process multiple articles concurrently"""
        logger.info(f"Starting processing of {len(urls)} articles")
        
        # Create semaphore for concurrency control
        semaphore = asyncio.Semaphore(self.max_concurrent)
        
        async def process_with_semaphore(url: str) -> ProcessedArticle:
            async with semaphore:
                result = await self.process_single_article(url)
                self._update_stats(result)
                
                if progress_callback:
                    progress_callback(result)
                
                return result
        
        # Process all URLs concurrently
        tasks = [process_with_semaphore(url) for url in urls]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Handle any exceptions in results
        processed_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                article = ProcessedArticle(
                    url=urls[i],
                    status=ProcessingStatus.FAILED,
                    error=str(result)
                )
                processed_results.append(article)
            else:
                processed_results.append(result)
        
        logger.info(f"Completed processing. Stats: {self.get_stats()}")
        return processed_results
    
    def _update_stats(self, article: ProcessedArticle):
        """Update processing statistics"""
        self._stats['total_processed'] += 1
        self._stats['total_time'] += article.processing_time
        
        if article.status == ProcessingStatus.SUCCESS:
            self._stats['successful'] += 1
        else:
            self._stats['failed'] += 1
    
    def get_stats(self) -> Dict[str, Any]:
        """Get processing statistics"""
        stats = self._stats.copy()
        if stats['total_processed'] > 0:
            stats['success_rate'] = stats['successful'] / stats['total_processed']
            stats['avg_processing_time'] = stats['total_time'] / stats['total_processed']
        else:
            stats['success_rate'] = 0.0
            stats['avg_processing_time'] = 0.0
        
        return stats
    
    async def save_results(self, 
                          results: List[ProcessedArticle], 
                          output_path: Path) -> None:
        """Save processing results to JSON file"""
        data = {
            'timestamp': datetime.now().isoformat(),
            'stats': self.get_stats(),
            'articles': [
                {
                    'url': article.url,
                    'title': article.title,
                    'summary': article.summary,
                    'status': article.status.value,
                    'error': article.error,
                    'processing_time': article.processing_time,
                    'metadata': {
                        'author': article.metadata.author if article.metadata else None,
                        'published_date': article.metadata.published_date if article.metadata else None,
                        'tags': article.metadata.tags if article.metadata else [],
                        'word_count': article.metadata.word_count if article.metadata else 0,
                        'image_count': len(article.metadata.images) if article.metadata else 0
                    }
                }
                for article in results
            ]
        }
        
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        async with aiofiles.open(output_path, 'w', encoding='utf-8') as f:
            await f.write(json.dumps(data, indent=2, ensure_ascii=False))
        
        logger.info(f"Results saved to {output_path}")
    
    async def __aenter__(self):
        """Async context manager entry"""
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit - cleanup resources"""
        if self.session:
            await self.session.close()


def progress_reporter(article: ProcessedArticle):
    """Example progress callback function"""
    status_icon = "✅" if article.status == ProcessingStatus.SUCCESS else "❌"
    logger.info(f"{status_icon} {article.url} - {article.status.value} ({article.processing_time:.2f}s)")


async def main():
    """Main execution function with example usage"""
    # Example URLs - replace with actual golf article URLs
    test_urls = [
        'https://www.golf.com/news/',
        'https://www.golfdigest.com/story/latest-golf-news',
        'https://www.golfmonthly.com/news',
        # Add more URLs as needed
    ]
    
    # Create processor with custom settings
    async with GolfArticleProcessor(
        max_concurrent=5,
        timeout=30,
        max_retries=3,
        rate_limit=10
    ) as processor:
        
        # Process articles
        results = await processor.process_articles(
            urls=test_urls,
            progress_callback=progress_reporter
        )
        
        # Save results
        output_path = Path('golf_articles_results.json')
        await processor.save_results(results, output_path)
        
        # Print summary
        stats = processor.get_stats()
        print(f"\nProcessing Summary:")
        print(f"Total Articles: {stats['total_processed']}")
        print(f"Successful: {stats['successful']}")
        print(f"Failed: {stats['failed']}")
        print(f"Success Rate: {stats['success_rate']:.1%}")
        print(f"Avg Processing Time: {stats['avg_processing_time']:.2f}s")
        
        # Print detailed results
        print("\nDetailed Results:")
        for article in results:
            if article.status == ProcessingStatus.SUCCESS:
                print(f"✅ {article.title}")
                print(f"   URL: {article.url}")
                if article.metadata:
                    print(f"   Author: {article.metadata.author or 'Unknown'}")
                    print(f"   Words: {article.metadata.word_count}")
            else:
                print(f"❌ {article.url}")
                print(f"   Error: {article.error}")


# For importing aiofiles
try:
    import aiofiles
except ImportError:
    logger.warning("aiofiles not installed. File operations will be synchronous.")
    # Fallback implementation
    class aiofiles:
        @staticmethod
        async def open(file, mode='r', **kwargs):
            return open(file, mode, **kwargs)


if __name__ == '__main__':
    # Run the async main function
    asyncio.run(main())