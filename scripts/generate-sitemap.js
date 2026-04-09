#!/usr/bin/env node
// Dolce Vita Roma sitemap generator
// Runs at Vercel build time via `npm run build`.
// Reads posts from blog_data.js (BLOG_POSTS array) and writes sitemap.xml at project root.
//
// URL FORMAT NOTE:
// DVR currently serves posts via the legacy query-param route /post?slug=<slug>.
// Vercel rewrite /post/:slug -> /post.html also exists but is not yet the canonical URL.
// This generator emits the legacy format so Google crawls reach 200 OK pages.
// After the URL migration (see 09 April QA review, P0-3) set USE_PATH_FORMAT = true.

const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const blogDataPath = path.join(projectRoot, 'blog_data.js');
const sitemapOutputPath = path.join(projectRoot, 'sitemap.xml');

const DOMAIN = 'https://dolcevitaroma.com';
const USE_PATH_FORMAT = false; // Flip to true after P0-3 URL migration

// Rule 2: block forbidden company slugs per user rules
const FORBIDDEN_SLUG_PATTERNS = [/i[n]deed/i, /s[y]ft/i];

function loadPosts() {
  const code = fs.readFileSync(blogDataPath, 'utf8');
  try {
    const fn = new Function(`${code}; return typeof BLOG_POSTS !== 'undefined' ? BLOG_POSTS : [];`);
    return fn();
  } catch (e) {
    console.error(`Failed to eval blog_data.js: ${e.message}`);
    // Fallback regex extraction
    const slugMatches = code.match(/slug:\s*['"`]([^'"`]+)['"`]/g) || [];
    return slugMatches.map(m => ({
      slug: m.replace(/slug:\s*['"`]/, '').replace(/['"`]$/, ''),
    }));
  }
}

function xmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function today() {
  return new Date().toISOString().split('T')[0];
}

function buildPostUrl(slug) {
  const encoded = encodeURIComponent(slug).replace(/%2F/g, '/');
  if (USE_PATH_FORMAT) {
    return `${DOMAIN}/blog/${encoded}`;
  }
  return `${DOMAIN}/post?slug=${encoded}`;
}

function main() {
  console.log('[DVR] Generating sitemap...');

  const posts = loadPosts();
  console.log(`[DVR] Loaded ${posts.length} posts from blog_data.js`);

  const lastmod = today();
  const urls = [];

  // Static pages
  urls.push({ loc: `${DOMAIN}/`, lastmod, changefreq: 'daily', priority: '1.0' });
  urls.push({ loc: `${DOMAIN}/blog`, lastmod, changefreq: 'daily', priority: '0.9' });

  // Blog posts
  let included = 0;
  let skipped = 0;
  const seenSlugs = new Set();

  for (const post of posts) {
    if (!post || !post.slug) {
      skipped++;
      continue;
    }
    if (seenSlugs.has(post.slug)) {
      skipped++;
      continue;
    }
    if (FORBIDDEN_SLUG_PATTERNS.some(re => re.test(post.slug))) {
      console.warn(`[DVR] SKIP forbidden slug: ${post.slug}`);
      skipped++;
      continue;
    }

    seenSlugs.add(post.slug);

    // Use publishDate as lastmod if in YYYY-MM-DD format
    const postLastmod = post.publishDate && /^\d{4}-\d{2}-\d{2}$/.test(post.publishDate)
      ? post.publishDate
      : lastmod;

    urls.push({
      loc: buildPostUrl(post.slug),
      lastmod: postLastmod,
      changefreq: 'monthly',
      priority: '0.8',
    });
    included++;
  }

  console.log(`[DVR] Included ${included} blog URLs, skipped ${skipped}`);

  // Build XML
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  for (const u of urls) {
    xml += '  <url>\n';
    xml += `    <loc>${xmlEscape(u.loc)}</loc>\n`;
    xml += `    <lastmod>${u.lastmod}</lastmod>\n`;
    xml += `    <changefreq>${u.changefreq}</changefreq>\n`;
    xml += `    <priority>${u.priority}</priority>\n`;
    xml += '  </url>\n';
  }
  xml += '</urlset>\n';

  fs.writeFileSync(sitemapOutputPath, xml, 'utf8');
  console.log(`[DVR] Wrote ${urls.length} URLs to ${sitemapOutputPath}`);
  console.log(`[DVR] URL format: ${USE_PATH_FORMAT ? '/blog/:slug' : '/post?slug=... (legacy)'}`);
}

main();
