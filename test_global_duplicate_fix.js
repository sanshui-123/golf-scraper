#!/usr/bin/env node

// 测试全局去重修复效果
const fs = require('fs');
const path = require('path');
const { checkGlobalDuplicate } = require('./check_global_duplicates');

console.log('🧪 测试全局去重修复...\n');

// 测试用例：已知的重复文章
const testCases = [
    {
        url: 'https://golf.com/news/lottie-woad-scottish-open-win-big-picture/',
        failedDate: '2025-07-27',
        failedNum: '209',
        successDate: '2025-07-28',
        successNum: '216'
    },
    {
        url: 'https://www.golfmonthly.com/features/the-game/what-is-strokeplay-in-golf-240302',
        failedDate: '2025-07-27',
        failedNum: '203',
        successDate: '2025-07-28',
        successNum: '211'
    }
];

// 测试每个用例
testCases.forEach(test => {
    console.log(`📄 测试URL: ${test.url}`);
    console.log(`   失败记录: ${test.failedDate}/文章${test.failedNum}`);
    console.log(`   成功记录: ${test.successDate}/文章${test.successNum}`);
    
    // 调用全局检查
    const result = checkGlobalDuplicate(test.url);
    
    if (result && result.hasContent) {
        console.log(`   ✅ 全局检查：找到成功记录在 ${result.date}/文章${result.articleNum}`);
        
        // 模拟修复过程
        const failedUrlsFile = path.join(__dirname, 'golf_content', test.failedDate, 'article_urls.json');
        if (fs.existsSync(failedUrlsFile)) {
            const urls = JSON.parse(fs.readFileSync(failedUrlsFile, 'utf8'));
            
            if (urls[test.failedNum] && typeof urls[test.failedNum] === 'object' && urls[test.failedNum].status === 'failed') {
                console.log(`   🔧 建议：将 ${test.failedDate}/文章${test.failedNum} 状态更新为 'duplicate'`);
                console.log(`   💡 这样可以避免重复处理\n`);
            }
        }
    } else {
        console.log(`   ❌ 全局检查：未找到成功记录\n`);
    }
});

// 演示修复后的效果
console.log('═══════════════════════════════════════════════════');
console.log('🔄 修复后的处理流程：\n');
console.log('1. 当遇到失败文章时，首先进行全局去重检查');
console.log('2. 如果在其他日期找到成功记录，直接跳过');
console.log('3. 更新状态为"duplicate"，避免未来重复处理');
console.log('4. 只处理真正失败的文章');
console.log('\n💡 这样可以避免：');
console.log('   - 重复调用Claude API（节省成本）');
console.log('   - 用户看到重复内容');
console.log('   - 浪费处理时间和资源');
console.log('═══════════════════════════════════════════════════');