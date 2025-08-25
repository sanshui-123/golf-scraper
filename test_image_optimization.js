#!/usr/bin/env node
const { chromium } = require('playwright');
const siteSpecificScrapers = require('./site_specific_scrapers');
const websiteConfigs = require('./website_configs.json');

/**
 * Test script to verify image processing for Today's Golfer and Golfweek
 */
async function testImageProcessing() {
    const testUrls = [
        {
            site: "Today's Golfer",
            url: "https://www.todays-golfer.com/equipment/golf-clubs/wedges/taylormade-mg5-wedge-review/"
        },
        {
            site: "Golfweek", 
            url: "https://golfweek.usatoday.com/story/sports/golf/2025/08/12/example-article/"
        }
    ];

    const scrapers = new siteSpecificScrapers();
    let browser;

    try {
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        });

        for (const test of testUrls) {
            console.log(`\n${'='.repeat(60)}`);
            console.log(`Testing ${test.site}: ${test.url}`);
            console.log('='.repeat(60));

            const page = await context.newPage();
            
            try {
                await page.goto(test.url, { 
                    waitUntil: 'networkidle',
                    timeout: 30000 
                });

                // Extract domain from URL
                const domain = new URL(test.url).hostname.replace('www.', '');
                
                // Check if special image handler is enabled
                const config = websiteConfigs[domain];
                console.log(`\n✅ Special Image Handler Enabled: ${config?.useSpecialImageHandler || false}`);

                // Get article content using site-specific scraper
                let articleData;
                switch (domain) {
                    case 'todays-golfer.com':
                        articleData = await scrapers.scrapeTodaysGolferArticle(page);
                        break;
                    case 'golfweek.usatoday.com':
                        articleData = await scrapers.scrapeGolfweekArticle(page);
                        break;
                    default:
                        console.log('❌ No specific scraper found for this domain');
                        continue;
                }

                // Check results
                console.log(`\n📝 Title: ${articleData.title || 'Not found'}`);
                console.log(`📸 Images found: ${articleData.images?.length || 0}`);
                
                if (articleData.images && articleData.images.length > 0) {
                    console.log('\nImage URLs:');
                    articleData.images.slice(0, 3).forEach((img, i) => {
                        console.log(`  ${i + 1}. ${img.substring(0, 100)}...`);
                    });
                } else {
                    console.log('❌ No images found - Image processing may need adjustment');
                }

                console.log(`\n✅ Content length: ${articleData.content?.length || 0} characters`);
                
            } catch (error) {
                console.error(`❌ Error testing ${test.site}:`, error.message);
            } finally {
                await page.close();
            }
        }

    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// Run the test
console.log('🧪 Testing Image Processing Optimizations');
console.log('=========================================\n');

testImageProcessing()
    .then(() => {
        console.log('\n✅ Test completed');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    });