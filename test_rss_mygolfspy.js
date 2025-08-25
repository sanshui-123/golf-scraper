#!/usr/bin/env node

const axios = require('axios');

async function testRSSFeed() {
    console.log('🧪 测试MyGolfSpy RSS Feed抓取方法...\n');
    
    const rssUrls = [
        'https://mygolfspy.com/feed/',
        'https://mygolfspy.com/reviews/feed/',
        'https://mygolfspy.com/news/feed/',
        'https://mygolfspy.com/instruction/feed/'
    ];
    
    for (const rssUrl of rssUrls) {
        console.log(`📡 尝试访问: ${rssUrl}`);
        
        try {
            const response = await axios.get(rssUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; RSS Reader; +http://example.com/bot)',
                    'Accept': 'application/rss+xml, application/xml, text/xml, */*'
                },
                timeout: 10000,
                maxRedirects: 5
            });
            
            console.log(`✅ 成功! 状态码: ${response.status}`);
            console.log(`📊 响应大小: ${(response.data.length / 1024).toFixed(1)}KB`);
            
            // 简单检查是否包含RSS内容
            if (response.data.includes('<rss') && response.data.includes('<item>')) {
                const itemCount = (response.data.match(/<item>/g) || []).length;
                console.log(`📋 包含 ${itemCount} 个文章项目`);
                
                // 提取第一个链接作为示例
                const firstLinkMatch = response.data.match(/<link>([^<]+)<\/link>/);
                if (firstLinkMatch) {
                    console.log(`🔗 示例链接: ${firstLinkMatch[1]}`);
                }
            } else {
                console.log('⚠️  响应不包含RSS内容');
            }
            
        } catch (error) {
            console.log(`❌ 失败: ${error.message}`);
            if (error.response) {
                console.log(`   状态码: ${error.response.status}`);
            }
        }
        
        console.log('---');
    }
}

testRSSFeed().catch(console.error);