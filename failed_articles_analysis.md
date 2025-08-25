# Failed Articles Analysis Report
Generated: 2025-07-29

## Summary

- **Total Failed Articles**: 39 entries (29 unique URLs)
- **Articles with 404 Errors**: 2 URLs confirmed as deleted
- **Articles with Processing Timeout**: 27 unique URLs
- **Sites Affected**: 5 websites

## Failed Articles by Website

### Golf Monthly (16 unique URLs, 23 failed entries)
Most failures - needs priority attention

#### Processing Timeout Articles:
1. **Live Event Coverage** (may be time-sensitive):
   - https://www.golfmonthly.com/news/live/liv-golf-uk-2025-leaderboard-live-updates (IDs: 205, 210)

2. **News Articles**:
   - https://www.golfmonthly.com/news/5-modern-links-courses-that-could-be-great-open-venues (IDs: 229, 258)
   - https://www.golfmonthly.com/news/from-lack-of-sleep-to-the-surprise-of-2019-what-open-golf-courses-are-to-shane-lowry (IDs: 226, 255)
   - https://www.golfmonthly.com/news/hes-a-flusher-with-a-good-track-record-on-links-courses-shane-lowrys-caddie-on-why-hes-backing-the-irishman-this-week (IDs: 227, 256)
   - https://www.golfmonthly.com/news/how-to-watch-the-open-championship-2025-potentially-for-free (IDs: 228, 257)
   - https://www.golfmonthly.com/news/ill-never-forget-the-experience-of-people-cheering-me-on-golf-influencer-grace-charis-talks-playing-with-john-daly (IDs: 230, 259)
   - https://www.golfmonthly.com/news/meet-the-9-amateurs-vying-for-the-silver-medal-at-royal-portrush (ID: 236)
   - https://www.golfmonthly.com/news/open-weather-forecast-2025 (ID: 235)
   - https://www.golfmonthly.com/news/the-historic-links-that-could-one-day-be-the-republic-of-irelands-first-open-venue (ID: 234)

3. **Tips/Instruction Articles**:
   - https://www.golfmonthly.com/tips/how-is-a-remote-electric-golf-trolley-actually-made-i-headed-behind-the-scenes-to-find-out (ID: 232)
   - https://www.golfmonthly.com/tips/how-many-1-putts-does-the-average-pga-tour-player-make-per-round (ID: 233)
   - https://www.golfmonthly.com/tips/my-short-game-was-utterly-horrific-until-i-discovered-this-1-simple-technique (ID: 239)
   - https://www.golfmonthly.com/tips/stop-digging-and-start-gliding-my-chip-shot-makeover-that-improved-my-consistency (ID: 238)
   - https://www.golfmonthly.com/tips/tiger-does-this-all-the-time-5-tour-pro-tips-to-help-you-hit-more-fairways (ID: 237)

4. **Features**:
   - https://www.golfmonthly.com/features/the-relative-safety-of-3-wood-off-the-tee-is-a-myth-and-the-data-proves-it (ID: 231)

#### 404 Errors (Article Deleted):
- https://www.golfmonthly.com/tips/ill-teach-you-the-greenside-bunker-shot-used-by-most-of-the-worlds-best-golfers (IDs: 225, 254)

### Golf Digest (10 unique URLs, 13 failed entries)

#### Processing Timeout Articles:
1. **Equipment/Gear Pages** (may be catalog pages):
   - https://www.golfdigest.com/equipment/hot-list (IDs: 192, 224)

2. **Story Articles**:
   - https://www.golfdigest.com/story/affordable-summer-destinations-golf-trips (IDs: 116, 193)
   - https://www.golfdigest.com/story/british-open-2025-making-the-shot-overcoming-first-tee-jitters-royal-ancient-golf-club (ID: 120)
   - https://www.golfdigest.com/story/british-open-2025-royal-portrush-course-preview (ID: 121)
   - https://www.golfdigest.com/story/cabot-highlands-old-petty-unforgettable-first-look-tom-doak-designed-golf-course (ID: 117)
   - https://www.golfdigest.com/story/choosing-the-end-of-the-world-durness-golf-club-alistair-morrison-playing-dirty-book-excerpt (ID: 119)
   - https://www.golfdigest.com/story/royal-portrush-video-every-hole-at (ID: 118)
   - https://www.golfdigest.com/story/rules-of-golf-review-using-powder-dry-grips-legal-penalty-or-not (ID: 167)
   - https://www.golfdigest.com/story/this-masters-week-tradition-is-coming-to-an-end-hint-john-daly-must-be-sad (ID: 166)

#### 404 Error (Article Deleted):
- https://www.golfdigest.com/story/british-open-2025-scottie-scheffler-claret-jug-notice (ID: 108 timeout, ID: 261 404)

### Golf.com (1 unique URL)
- https://golf.com/gear/ (ID: 191) - Processing timeout (likely a category page)

### MyGolfSpy (1 unique URL)
- https://mygolfspy.com/news-opinion/first-look/malbon-teams-up-with-etnies-for-skateshoe-crossover/ (ID: 160) - Processing timeout

### GolfWRX (1 unique URL)
- https://www.golfwrx.com/763851/kurt-kitayama-witb-2025-july-3m-open/?utm_source=Front&utm_medium=Featured_Center_Top&utm_campaign=GolfWRX_OnSite&utm_content=main (ID: 221) - Processing timeout

## Recommendations

1. **Exclude 404 Articles** (2 URLs):
   - Golf Monthly bunker shot article (IDs: 225, 254)
   - Golf Digest Scottie Scheffler article (IDs: 108, 261)

2. **Skip Category/Equipment Pages** (3 URLs):
   - Golf Digest Hot List page
   - Golf.com gear page
   These appear to be category/listing pages, not articles

3. **Priority Processing** (24 unique article URLs):
   - Focus on Golf Monthly articles first (highest failure count)
   - Then process Golf Digest story articles
   - Finally process MyGolfSpy and GolfWRX single articles

4. **Live Coverage Note**:
   - The Golf Monthly LIV Golf leaderboard URL appears to be live event coverage which may no longer be relevant

## Processing Strategy

1. Create a batch file with the 24 valid article URLs
2. Use the `process_remaining_articles.js` or similar processor
3. Increase timeout settings if needed for Golf Monthly articles
4. Monitor for any new 404 errors during processing