#!/usr/bin/env node

/**
 * 处理MyGolfSpy剩余的8篇文章
 */

const BatchProcessor = require('./batch_process_articles');

// MyGolfSpy剩余的8篇文章URL
const remainingUrls = [
    "https://mygolfspy.com/news-opinion/asked-on-reddit-whats-a-good-indicator-someone-is-good-at-golf/",
    "https://mygolfspy.com/news-opinion/instruction/the-most-common-golf-grip-mistakes-and-how-to-fix-them-fast/",
    "https://mygolfspy.com/news-opinion/which-holes-were-the-hardest-at-the-2025-open-championship-heres-the-full-breakdown/",
    "https://mygolfspy.com/news-opinion/designed-by-tiger-the-sun-day-red-osprey-an-apex-predator-of-golf-footwear/",
    "https://mygolfspy.com/news-opinion/tour/major-grades-scheffler-takes-over-rahm-cant-contend-smith-disappears/",
    "https://mygolfspy.com/buyers-guide/top-10-straightest-drivers-of-2025/",
    "https://mygolfspy.com/news-opinion/instruction/wedge-ball-position-explained-and-why-it-changes-by-shot-type/",
    "https://mygolfspy.com/golf-travel/mygolfspy-experiences-does-whistling-straits-belong-on-your-golfer-do-list/"
];

async function processRemaining() {
    console.log('🔍 处理MyGolfSpy剩余的8篇文章\n');
    
    const processor = new BatchProcessor();
    
    try {
        await processor.processArticles(remainingUrls, 'mygolfspy.com');
        console.log('\n✅ 处理完成！');
    } catch (error) {
        console.error('❌ 处理失败:', error.message);
    }
}

if (require.main === module) {
    processRemaining();
}