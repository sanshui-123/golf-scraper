#!/usr/bin/env node

const axios = require('axios');

async function testAPI() {
    const config = {
        apiHost: 'http://127.0.0.1',
        apiPort: 54345,
        apiKey: '34f2d7b955974ed8ae29759243693681'
    };
    
    console.log('测试比特浏览器API连接...\n');
    
    // 测试GET请求
    console.log('1. 测试GET /browser/list');
    try {
        const response = await axios.get(`${config.apiHost}:${config.apiPort}/browser/list`, {
            headers: {
                'x-api-key': config.apiKey
            },
            timeout: 5000
        });
        console.log('✅ GET请求成功');
        console.log('响应:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.log('❌ GET请求失败:', error.message);
        if (error.response) {
            console.log('响应状态:', error.response.status);
            console.log('响应数据:', error.response.data);
        }
    }
    
    console.log('\n2. 测试POST /browser/list');
    try {
        const response = await axios.post(`${config.apiHost}:${config.apiPort}/browser/list`, {
            page: 1,
            pageSize: 100
        }, {
            headers: {
                'x-api-key': config.apiKey,
                'Content-Type': 'application/json'
            },
            timeout: 5000
        });
        console.log('✅ POST请求成功');
        console.log('响应:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.log('❌ POST请求失败:', error.message);
        if (error.response) {
            console.log('响应状态:', error.response.status);
            console.log('响应数据:', error.response.data);
        }
    }
}

testAPI().catch(console.error);