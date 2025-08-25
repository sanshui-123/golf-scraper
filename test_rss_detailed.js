#!/usr/bin/env node

const axios = require('axios');
const xml2js = require('xml2js');

async function testDetailedRSSFeed() {
    console.log('🔬 详细测试MyGolfSpy RSS Feed...\n');
    
    const rssUrl = 'https://mygolfspy.com/feed/';
    
    try {
        console.log(`📡 获取RSS Feed: ${rssUrl}`);
        
        const response = await axios.get(rssUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; RSS Reader; +http://example.com/bot)',
                'Accept': 'application/rss+xml, application/xml, text/xml, */*'
            },
            timeout: 15000
        });
        
        console.log(`✅ 获取成功! 状态码: ${response.status}\n`);
        
        // 解析XML
        const parser = new xml2js.Parser();
        const result = await parser.parseStringPromise(response.data);
        
        if (result.rss && result.rss.channel && result.rss.channel[0].item) {
            const items = result.rss.channel[0].item;
            console.log(`📋 找到 ${items.length} 篇文章:\n`);
            
            // 显示前5篇文章
            items.slice(0, 5).forEach((item, index) => {
                console.log(`${index + 1}. 标题: ${item.title[0]}`);
                console.log(`   链接: ${item.link[0]}`);
                console.log(`   发布时间: ${item.pubDate ? item.pubDate[0] : 'N/A'}`);
                
                // 检查分类
                if (item.category) {
                    const categories = item.category.map(cat => 
                        typeof cat === 'string' ? cat : cat._
                    ).join(', ');
                    console.log(`   分类: ${categories}`);
                }
                console.log('');
            });
            
            // 测试直接访问第一篇文章
            if (items.length > 0) {
                const firstUrl = items[0].link[0];
                console.log(`\n🔍 测试访问第一篇文章: ${firstUrl}`);
                
                try {
                    const articleResponse = await axios.get(firstUrl, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        },
                        timeout: 10000,
                        maxRedirects: 5
                    });
                    
                    console.log(`✅ 文章访问成功! 状态码: ${articleResponse.status}`);
                    console.log(`📊 文章大小: ${(articleResponse.data.length / 1024).toFixed(1)}KB`);
                    
                    // 检查是否包含实际内容
                    if (articleResponse.data.includes('403 Forbidden')) {
                        console.log('⚠️  文章内容是403错误页面');
                    } else if (articleResponse.data.includes('article') || articleResponse.data.includes('content')) {
                        console.log('✅ 看起来包含实际文章内容');
                    }
                    
                } catch (articleError) {
                    console.log(`❌ 文章访问失败: ${articleError.message}`);
                    if (articleError.response) {
                        console.log(`   状态码: ${articleError.response.status}`);
                    }
                }
            }
            
            // 统计分类
            console.log('\n📊 文章分类统计:');
            const categoryCount = {};
            items.forEach(item => {
                if (item.category) {
                    item.category.forEach(cat => {
                        const catName = typeof cat === 'string' ? cat : cat._;
                        categoryCount[catName] = (categoryCount[catName] || 0) + 1;
                    });
                }
            });
            
            Object.entries(categoryCount)
                .sort((a, b) => b[1] - a[1])
                .forEach(([cat, count]) => {
                    console.log(`   ${cat}: ${count} 篇`);
                });
            
            return items.map(item => ({
                url: item.link[0],
                title: item.title[0],
                pubDate: item.pubDate ? item.pubDate[0] : null,
                categories: item.category ? item.category.map(cat => 
                    typeof cat === 'string' ? cat : cat._
                ) : []
            }));
            
        } else {
            console.log('❌ RSS格式解析失败');
        }
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        if (error.response) {
            console.log(`状态码: ${error.response.status}`);
        }
    }
}

testDetailedRSSFeed().catch(console.error);