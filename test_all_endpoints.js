#!/usr/bin/env node

const axios = require('axios');
const config = require('./bitbrowser_config.json');

async function testAllEndpoints() {
    console.log('测试所有可能的比特浏览器API端点...\n');
    
    const baseUrl = `${config.apiHost}:${config.apiPort}`;
    const apiKey = config.apiKey;
    
    // 可能的端点列表
    const endpoints = [
        { method: 'GET', path: '/', desc: '根路径' },
        { method: 'GET', path: '/api', desc: 'API根路径' },
        { method: 'GET', path: '/api/v1', desc: 'API v1' },
        { method: 'GET', path: '/browser/list', desc: '浏览器列表(GET)' },
        { method: 'POST', path: '/browser/list', desc: '浏览器列表(POST)' },
        { method: 'GET', path: '/api/browser/list', desc: 'API浏览器列表(GET)' },
        { method: 'POST', path: '/api/browser/list', desc: 'API浏览器列表(POST)' },
        { method: 'GET', path: '/api/v1/browser/list', desc: 'API v1浏览器列表(GET)' },
        { method: 'POST', path: '/api/v1/browser/list', desc: 'API v1浏览器列表(POST)' },
        { method: 'GET', path: '/open/list', desc: '开放列表' },
        { method: 'POST', path: '/open/list', desc: '开放列表(POST)' },
        { method: 'GET', path: '/browser', desc: '浏览器' },
        { method: 'GET', path: '/profile/list', desc: '配置文件列表' },
        { method: 'POST', path: '/profile/list', desc: '配置文件列表(POST)' },
    ];
    
    console.log(`基础URL: ${baseUrl}`);
    console.log(`API Key: ${apiKey}\n`);
    
    for (const endpoint of endpoints) {
        const url = `${baseUrl}${endpoint.path}`;
        console.log(`测试 ${endpoint.method} ${url} - ${endpoint.desc}`);
        
        try {
            let response;
            const headers = {
                'x-api-key': apiKey,
                'Content-Type': 'application/json'
            };
            
            if (endpoint.method === 'GET') {
                response = await axios.get(url, {
                    headers,
                    timeout: 3000
                });
            } else {
                response = await axios.post(url, {
                    page: 1,
                    pageSize: 10
                }, {
                    headers,
                    timeout: 3000
                });
            }
            
            console.log('✅ 成功!');
            console.log('响应状态:', response.status);
            console.log('响应数据:', JSON.stringify(response.data, null, 2).substring(0, 200));
            console.log('---\n');
            
            // 如果找到有效端点，保存信息
            if (response.data && (response.data.success === true || response.data.code === 0)) {
                console.log('\n🎉 找到有效的API端点！');
                console.log(`方法: ${endpoint.method}`);
                console.log(`路径: ${endpoint.path}`);
                console.log(`完整URL: ${url}`);
                break;
            }
            
        } catch (error) {
            if (error.response) {
                console.log(`❌ 失败 - 状态码: ${error.response.status}`);
                if (error.response.data) {
                    console.log('错误信息:', JSON.stringify(error.response.data, null, 2).substring(0, 200));
                }
            } else {
                console.log(`❌ 失败 - ${error.message}`);
            }
            console.log('---\n');
        }
    }
}

testAllEndpoints().catch(console.error);