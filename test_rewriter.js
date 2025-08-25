const ArticleRewriterEnhanced = require('./article_rewriter_enhanced.js');
const fs = require('fs');

async function testRewriter() {
    const rewriter = new ArticleRewriterEnhanced();

    // Parse test article content to extract title and content
    const testContent = fs.readFileSync('test_article_for_rewrite.txt', 'utf8');
    const lines = testContent.split('\n');
    const titleLine = lines.find(line => line.startsWith('**Title**:'));
    const title = titleLine ? titleLine.replace('**Title**: ', '') : 'Test Article';

    const contentStart = testContent.indexOf('**Content**:');
    const content = contentStart !== -1 ? testContent.substring(contentStart + 12).trim() : testContent;

    console.log('Extracted title:', title);
    console.log('Content length:', content.length);

    try {
        // Test the rewriter with proper parameters
        const result = await rewriter.rewriteArticle(title, content);
        console.log('\n✅ Rewrite successful!');
        console.log('Output length:', result.length);
        console.log('\n--- First 800 characters ---');
        console.log(result.substring(0, 800));
        
        // Save the result
        fs.writeFileSync('test_rewrite_output.txt', result);
        console.log('\n📁 Result saved to test_rewrite_output.txt');
    } catch (error) {
        console.error('❌ Rewrite failed:', error.message);
    }
}

testRewriter();