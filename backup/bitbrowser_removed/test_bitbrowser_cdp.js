#!/usr/bin/env node

const axios = require('axios');

async function testCDP() {
    console.log('测试比特浏览器Chrome DevTools Protocol...\n');
    
    const port = 54346;
    const apiKey = '34f2d7b955974ed8ae29759243693681';
    
    // Chrome DevTools Protocol常见端点
    const endpoints = [
        '/json',
        '/json/version',
        '/json/list',
        '/devtools/browser',
        ''
    ];
    
    for (const endpoint of endpoints) {
        const url = `http://127.0.0.1:${port}${endpoint}`;
        console.log(`测试: ${url}`);
        
        try {
            // 尝试带API Key
            const response1 = await axios.get(url, {
                headers: {
                    'x-api-key': apiKey
                },
                timeout: 2000
            });
            console.log('✅ 成功（带API Key）!');
            console.log('响应:', JSON.stringify(response1.data, null, 2));
            console.log('\n');
        } catch (error) {
            // 尝试不带API Key
            try {
                const response2 = await axios.get(url, {
                    timeout: 2000
                });
                console.log('✅ 成功（无API Key）!');
                console.log('响应:', JSON.stringify(response2.data, null, 2));
                console.log('\n');
            } catch (error2) {
                console.log('❌ 失败:', error2.message);
                console.log('\n');
            }
        }
    }
    
    // 尝试通过curl命令
    console.log('使用curl测试根路径...');
    const { exec } = require('child_process');
    exec(`curl -s -H "x-api-key: ${apiKey}" http://127.0.0.1:${port}/`, (error, stdout, stderr) => {
        if (stdout) {
            console.log('Curl响应:', stdout);
        }
        if (error) {
            console.log('Curl错误:', error.message);
        }
    });
}

testCDP().catch(console.error);