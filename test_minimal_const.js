#!/usr/bin/env node

// 测试const赋值问题
function testForEach() {
    const elements = ['IMG', 'FIGURE', 'P', 'FIGURE'];
    
    elements.forEach(elem => {
        console.log('处理元素:', elem);
        
        if (elem === 'IMG' || elem === 'FIGURE') {
            const img = elem === 'FIGURE' ? 'figure中的img' : elem;
            console.log('  img:', img);
            
            // 测试是否是这里的问题
            if (elem === 'FIGURE') {
                const figcaption = 'figcaption内容';
                console.log('  figcaption:', figcaption);
            }
        }
    });
}

// 测试另一种可能
function testForEachWithElements() {
    const elements = [
        { tagName: 'IMG', alt: 'img1' },
        { tagName: 'FIGURE', querySelector: () => ({ alt: 'img2' }) },
        { tagName: 'P' },
        { tagName: 'FIGURE', querySelector: () => ({ alt: '' }) }  // 空alt会触发错误
    ];
    
    elements.forEach((elem, index) => {
        if (elem.tagName === 'IMG' || elem.tagName === 'FIGURE') {
            const img = elem.tagName === 'FIGURE' ? elem.querySelector() : elem;
            console.log(`元素${index}: ${elem.tagName}, alt: ${img.alt}`);
            
            let alt = img.alt || '';
            if (elem.tagName === 'FIGURE' && !alt) {
                // 这里会不会有问题？
                const elem = 'test'; // 这会导致错误！
                console.log(elem);
            }
        }
    });
}

console.log('测试1:');
testForEach();

console.log('\n测试2:');
try {
    testForEachWithElements();
} catch (e) {
    console.error('错误:', e.message);
}