chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scrapeURLs') {
    const urls = scrapeArticleURLs();
    sendResponse({ urls: urls });
  }
});

function scrapeArticleURLs() {
  const urls = [];
  
  // 基于现有网站配置的多种选择器策略
  const selectors = [
    // 基于现有website_configs.json的MyGolfSpy配置
    'a[href*="/news/"]',
    'a[href*="/instruction/"]', 
    'a[href*="/reviews/"]',
    'a[href*="/buyers-guides/"]',
    'a[href*="/most-wanted/"]',
    'a[href*="/ball-lab/"]',
    'a[href*="/golf-spy/"]',
    
    // 通用选择器
    '.post-item a',
    '.article-item a',
    '.card a',
    '.entry a',
    '.post a',
    'h2 a',
    'h3 a',
    '.title a',
    '.entry-title a',
    
    // 更广泛的选择器
    'article a[href*="mygolfspy.com"]',
    '.content a[href*="mygolfspy.com"]',
    'main a[href*="mygolfspy.com"]'
  ];
  
  selectors.forEach(selector => {
    try {
      document.querySelectorAll(selector).forEach(link => {
        const href = link.href;
        const title = link.textContent.trim() || link.title || link.getAttribute('alt') || '';
        
        if (href && title && href.includes('mygolfspy.com') && !urls.some(u => u.url === href)) {
          // 过滤掉一些不需要的链接
          if (isValidArticleURL(href)) {
            urls.push({
              url: href,
              title: title,
              category: getCategoryFromURL(href),
              scrapedAt: new Date().toISOString(),
              selector: selector
            });
          }
        }
      });
    } catch (error) {
      console.warn(`选择器 ${selector} 执行失败:`, error);
    }
  });
  
  // 按分类和标题排序
  urls.sort((a, b) => {
    if (a.category !== b.category) {
      return a.category.localeCompare(b.category);
    }
    return a.title.localeCompare(b.title);
  });
  
  console.log(`MyGolfSpy URL抓取器: 找到 ${urls.length} 个链接`);
  return urls;
}

function getCategoryFromURL(url) {
  const patterns = [
    { pattern: '/news/', category: 'news' },
    { pattern: '/instruction/', category: 'instruction' },
    { pattern: '/reviews/', category: 'reviews' },
    { pattern: '/buyers-guides/', category: 'buyers-guides' },
    { pattern: '/most-wanted/', category: 'most-wanted' },
    { pattern: '/ball-lab/', category: 'ball-lab' },
    { pattern: '/golf-spy/', category: 'golf-spy' }
  ];
  
  for (const { pattern, category } of patterns) {
    if (url.includes(pattern)) {
      return category;
    }
  }
  
  return 'other';
}

function isValidArticleURL(url) {
  // 过滤掉不需要的链接
  const excludePatterns = [
    '/wp-admin/',
    '/wp-login/',
    '/feed/',
    '/author/',
    '/category/',
    '/tag/',
    '/page/',
    '/search/',
    '/comments/',
    '/#',
    '.jpg',
    '.png',
    '.gif',
    '.pdf',
    '.zip',
    'mailto:',
    'tel:',
    'javascript:',
    'about:',
    'contact',
    'privacy',
    'terms',
    'sitemap'
  ];
  
  const urlLower = url.toLowerCase();
  
  for (const pattern of excludePatterns) {
    if (urlLower.includes(pattern)) {
      return false;
    }
  }
  
  // 确保是完整的文章URL
  const articlePatterns = [
    '/news/',
    '/instruction/',
    '/reviews/',
    '/buyers-guides/',
    '/most-wanted/',
    '/ball-lab/',
    '/golf-spy/'
  ];
  
  return articlePatterns.some(pattern => url.includes(pattern));
}