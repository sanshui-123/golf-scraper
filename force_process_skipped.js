const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// 查找所有被跳过的URL
console.log('🔍 查找所有被跳过的URL...\n');

const skippedUrls = [];
const baseDir = 'golf_content';

// 扫描所有日期目录
const dateDirs = fs.readdirSync(baseDir)
    .filter(dir => /^\d{4}-\d{2}-\d{2}$/.test(dir));

for (const dateDir of dateDirs) {
    const urlsJsonPath = path.join(baseDir, dateDir, 'article_urls.json');
    
    if (fs.existsSync(urlsJsonPath)) {
        try {
            const urlMapping = JSON.parse(fs.readFileSync(urlsJsonPath, 'utf8'));
            for (const [articleNum, record] of Object.entries(urlMapping)) {
                if (typeof record === 'object' && record.status === 'skipped') {
                    // 检查文件是否真的存在
                    const articleFile = path.join(baseDir, dateDir, 'wechat_ready', `wechat_article_${articleNum}.md`);
                    if (!fs.existsSync(articleFile)) {
                        skippedUrls.push({
                            url: record.url,
                            date: dateDir,
                            articleNum: articleNum,
                            reason: record.reason || '未知'
                        });
                    }
                }
            }
        } catch (e) {
            console.error(`解析 ${urlsJsonPath} 失败:`, e.message);
        }
    }
}

console.log(`找到 ${skippedUrls.length} 个被跳过且文件不存在的URL：\n`);

skippedUrls.forEach((item, idx) => {
    console.log(`${idx + 1}. ${item.url}`);
    console.log(`   日期: ${item.date}, 编号: ${item.articleNum}, 原因: ${item.reason}`);
});

if (skippedUrls.length === 0) {
    console.log('✅ 没有找到需要处理的跳过URL');
    process.exit(0);
}

// 创建临时文件包含这些URL
const tempFile = `force_skipped_urls_${Date.now()}.txt`;
const urlList = skippedUrls.map(item => item.url).join('\n');
fs.writeFileSync(tempFile, urlList);

console.log(`\n📝 创建临时文件: ${tempFile}`);
console.log('🚀 开始强制处理这些URL...\n');

// 调用批处理程序，但需要修改状态以允许处理
// 首先删除这些URL的缓存记录
for (const item of skippedUrls) {
    const urlsJsonPath = path.join(baseDir, item.date, 'article_urls.json');
    if (fs.existsSync(urlsJsonPath)) {
        try {
            const urlMapping = JSON.parse(fs.readFileSync(urlsJsonPath, 'utf8'));
            // 将状态改为failed以允许重试
            if (urlMapping[item.articleNum]) {
                urlMapping[item.articleNum].status = 'failed';
                urlMapping[item.articleNum].error = '需要重新处理';
                fs.writeFileSync(urlsJsonPath, JSON.stringify(urlMapping, null, 2));
            }
        } catch (e) {}
    }
}

// 现在运行批处理
const child = spawn('node', ['batch_process_articles.js', tempFile], {
    stdio: 'inherit'
});

child.on('exit', (code) => {
    // 清理临时文件
    try {
        fs.unlinkSync(tempFile);
    } catch (e) {}
    
    console.log(`\n✅ 处理完成，退出码: ${code}`);
});