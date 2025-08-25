#!/usr/bin/env node

const WebSocket = require('ws');
const axios = require('axios');

async function testWebSocketConnection() {
    console.log('测试比特浏览器WebSocket连接...\n');
    
    const wsUrl = 'ws://127.0.0.1:54346';
    const apiKey = '34f2d7b955974ed8ae29759243693681';
    
    try {
        // 测试WebSocket连接
        console.log('1. 尝试WebSocket连接到', wsUrl);
        const ws = new WebSocket(wsUrl, {
            headers: {
                'x-api-key': apiKey
            }
        });
        
        ws.on('open', () => {
            console.log('✅ WebSocket连接成功！');
            
            // 发送测试消息
            const testMessage = {
                type: 'browser.list',
                data: {
                    page: 1,
                    pageSize: 10
                }
            };
            
            console.log('\n2. 发送测试消息:', JSON.stringify(testMessage));
            ws.send(JSON.stringify(testMessage));
        });
        
        ws.on('message', (data) => {
            console.log('\n✅ 收到响应:');
            console.log(JSON.parse(data.toString()));
            ws.close();
        });
        
        ws.on('error', (error) => {
            console.log('❌ WebSocket错误:', error.message);
        });
        
        ws.on('close', () => {
            console.log('\nWebSocket连接已关闭');
        });
        
    } catch (error) {
        console.error('连接失败:', error.message);
    }
    
    // 也尝试HTTP连接
    console.log('\n3. 尝试HTTP连接...');
    try {
        // 尝试不同的端点
        const endpoints = [
            '/browser/list',
            '/api/browser/list',
            '/api/v1/browser/list',
            '/'
        ];
        
        for (const endpoint of endpoints) {
            try {
                console.log(`   测试 http://127.0.0.1:54346${endpoint}`);
                const response = await axios.get(`http://127.0.0.1:54346${endpoint}`, {
                    headers: {
                        'x-api-key': apiKey
                    },
                    timeout: 2000
                });
                console.log(`   ✅ 成功! 响应:`, response.data);
                break;
            } catch (e) {
                console.log(`   ❌ 失败:`, e.message);
            }
        }
    } catch (error) {
        console.log('HTTP测试完成');
    }
}

testWebSocketConnection().catch(console.error);

// 保持进程运行几秒以接收WebSocket响应
setTimeout(() => {
    process.exit(0);
}, 5000);