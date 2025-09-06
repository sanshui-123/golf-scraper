#!/bin/bash

echo "🧪 快速测试Claude 3.5 Sonnet模型..."
echo ""

# 测试简单请求
echo "📝 发送测试请求..."
node -e "
const Anthropic = require('@anthropic-ai/sdk');
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
});

async function test() {
    const start = Date.now();
    try {
        const response = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 100,
            messages: [{role: 'user', content: '用一句话总结：高尔夫是世界上最棒的运动。'}]
        });
        const duration = ((Date.now() - start) / 1000).toFixed(1);
        console.log('✅ 成功！响应时间: ' + duration + '秒');
        console.log('响应: ' + response.content[0].text);
        
        if (duration < 10) {
            console.log('⚡ 速度优秀！比旧模型快多了！');
        }
    } catch (error) {
        const duration = ((Date.now() - start) / 1000).toFixed(1);
        console.log('❌ 失败！时间: ' + duration + '秒');
        console.log('错误: ' + error.message);
    }
}

test();
" 2>&1

echo ""
echo "📊 对比信息："
echo "  • 旧模型: 50-60秒响应"
echo "  • 新模型: 预期5-15秒响应"