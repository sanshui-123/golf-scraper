const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// 极简文章处理器 - 遵循"单一最优方案"原则
async function processArticle(url) {
    console.log('🚀 处理文章:', url);
    
    // 1. 模拟获取文章内容（使用正确的格式）
    const promptContent = fs.readFileSync('golf_rewrite_prompt_turbo.txt', 'utf8');
    const articleContent = `

Title: Rory McIlroy and FedEx Cup Playoffs Rule

Rory McIlroy is skipping the first FedEx Cup playoff event in Memphis. This has caused some discussion about whether the rules need to be changed.

[IMAGE_1:Rory McIlroy at the Open Championship]

The article discusses Rory's decision to skip the Memphis tournament and whether the PGA Tour should implement a "Rory Rule" to prevent this in the future.

Peter Malnati hinted that changes might be coming to prevent top players from skipping playoff events.
`;
    
    const mockContent = promptContent + '\n\n' + articleContent;

    // 2. 创建临时文件
    const tempFile = `temp_simple_${Date.now()}.txt`;
    fs.writeFileSync(tempFile, mockContent);
    
    try {
        // 3. 调用Claude
        console.log('⏳ 调用Claude改写...');
        const result = await new Promise((resolve, reject) => {
            const cmd = `claude --dangerously-skip-permissions --print < ${tempFile}`;
            const proc = exec(cmd, { maxBuffer: 10 * 1024 * 1024 });
            
            let output = '';
            let startTime = Date.now();
            
            proc.stdout.on('data', (data) => {
                output += data;
                const elapsed = Math.round((Date.now() - startTime) / 1000);
                process.stdout.write(`\r⏳ 等待响应... ${elapsed}秒`);
            });
            
            proc.stderr.on('data', (data) => {
                console.error('\n❌ 错误:', data.toString());
            });
            
            proc.on('exit', (code, signal) => {
                console.log('\n');
                if (code === 0) {
                    resolve(output);
                } else {
                    reject(new Error(`退出码: ${code}, 信号: ${signal}`));
                }
            });
            
            // 超时保护
            setTimeout(() => {
                if (proc.exitCode === null) {
                    proc.kill('SIGTERM');
                    reject(new Error('超时（60秒）'));
                }
            }, 60000);
        });
        
        // 4. 保存结果
        console.log('✅ 改写成功！');
        console.log('📝 完整结果:');
        console.log('---开始---');
        console.log(result);
        console.log('---结束---');
        
        // 5. 清理
        fs.unlinkSync(tempFile);
        
        return true;
    } catch (error) {
        console.error('❌ 处理失败:', error.message);
        // 清理
        if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
        }
        return false;
    }
}

// 主函数
async function main() {
    const testUrl = 'https://golf.com/news/rory-mcilroy-fedex-cup-playoffs-rule/';
    await processArticle(testUrl);
    console.log('\n✅ 测试完成');
}

// 捕获所有信号
process.on('SIGTERM', () => {
    console.log('\n⚠️ 收到SIGTERM信号');
});

process.on('SIGINT', () => {
    console.log('\n⚠️ 收到SIGINT信号（Ctrl+C）');
    process.exit(0);
});

// 运行
main().catch(console.error);