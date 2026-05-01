#!/usr/bin/env node
// prerender-blog.js — generate static HTML for every published post
// matching the live dolcevitaroma.com design (green/cream/Anton)

const fs   = require('fs');
const path = require('path');

// ── load blog_data.js ──────────────────────────────────────────────────────
const src     = fs.readFileSync(path.join(__dirname, '../blog_data.js'), 'utf8');
const modified = src.replace('const BLOG_POSTS', 'var BLOG_POSTS');
const vm      = require('vm');
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(modified, sandbox);
const ALL_POSTS = sandbox.BLOG_POSTS;

const today = new Date().toISOString().split('T')[0];
const posts = ALL_POSTS
  .filter(p => p.publishDate <= today)
  .sort((a, b) => new Date(b.publishDate) - new Date(a.publishDate));

const OUT_DIR = path.join(__dirname, '../public/blog');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// ── shared CSS ────────────────────────────────────────────────────────────
const SHARED_CSS = `
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    :root {
      --green: #2B3A1B; --green-light: #3D5226; --red: #C1553A;
      --cream: #F5EBD8; --gold: #D4A545; --salmon: #E09B88;
      --black: #1A1A1A; --white: #FAFAF5;
    }
    body { font-family: 'Inter', -apple-system, sans-serif; background: var(--cream); color: var(--black); line-height: 1.7; }
    nav { background: var(--green); padding: 0.8rem 2rem; display: flex; justify-content: space-between; align-items: center; position: relative; }
    nav .logo-link { display: flex; align-items: center; gap: 0.6rem; text-decoration: none; }
    nav .logo-link img { width: 32px; height: 32px; border-radius: 50%; }
    nav .logo-text { font-family: 'Anton', sans-serif; color: var(--cream); font-size: 1.1rem; letter-spacing: 0.05em; text-transform: uppercase; text-decoration: none; }
    nav ul { list-style: none; display: flex; gap: 1.8rem; }
    nav ul a { color: var(--cream); text-decoration: none; font-size: 0.85rem; font-weight: 500; letter-spacing: 0.03em; text-transform: uppercase; transition: color 0.2s; }
    nav ul a:hover { color: var(--gold); }
    nav .nav-toggle { display: none; background: none; border: none; cursor: pointer; padding: 0.3rem; }
    nav .nav-toggle span { display: block; width: 22px; height: 2px; background: var(--cream); margin: 4px 0; }
    @media (max-width: 768px) {
      nav ul { display: none; }
      nav ul.open { display: flex; flex-direction: column; position: absolute; top: 100%; left: 0; right: 0; background: var(--green); padding: 1rem 2rem; gap: 1rem; z-index: 100; }
      nav .nav-toggle { display: block; }
    }
    footer { background: var(--green); color: var(--salmon); text-align: center; padding: 2rem; }
    footer a { color: var(--cream); text-decoration: none; }
    footer a:hover { color: var(--gold); }
`;

// ── nav HTML (from blog/slug.html perspective) ───────────────────────────
const NAV = `<nav>
    <a href="../" class="logo-link"><img src="../images/logo.png" alt="Logo" width="32" height="32"><span class="logo-text">Dolce Vita Roma</span></a>
    <button class="nav-toggle" onclick="document.querySelector('nav ul').classList.toggle('open')" aria-label="Toggle menu"><span></span><span></span><span></span></button>
    <ul>
      <li><a href="../">Blog</a></li>
      <li><a href="https://dolcevitaroma.com" target="_blank">Main Site</a></li>
      <li><a href="https://dolcevitaroma.com/contact" target="_blank">Contact</a></li>
      <li><a href="./">Blog</a></li>
      <li><a href="../#newsletter">Join</a></li>
    </ul>
  </nav>`;

function formatDate(d) {
  return new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function escHtml(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── generate individual post page ─────────────────────────────────────────
function renderPost(p) {
  const dateStr   = formatDate(p.publishDate);
  const canonical = `https://dolcevitaroma.com/blog/${p.slug}.html`;
  const desc      = escHtml(p.metaDescription || p.tldr || '');
  const title     = escHtml(p.title || '');
  const category  = escHtml(p.category || '');

  const imgUrl  = p.image || 'https://dolcevitaroma.com/og-image.jpg';
  const imgEsc  = escHtml(imgUrl);

  // Schema markup
  const schema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": p.title,
    "description": p.metaDescription || p.tldr || '',
    "image": imgUrl,
    "datePublished": p.publishDate,
    "dateModified": p.publishDate,
    "author": { "@type": "Organization", "name": "Dolce Vita Roma" },
    "publisher": { "@type": "Organization", "name": "Dolce Vita Roma", "url": "https://dolcevitaroma.com" },
    "mainEntityOfPage": canonical
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <title>${title} | Dolce Vita Roma</title>
  <meta name="description" content="${desc}">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${desc}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:site_name" content="Dolce Vita Roma">
  <meta property="og:image" content="${imgEsc}">
  <meta property="og:image:alt" content="${title}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${desc}">
  <meta name="twitter:image" content="${imgEsc}">
  <link rel="canonical" href="${canonical}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700&display=swap">
  <script type="application/ld+json">${schema}</script>
  <style>${SHARED_CSS}
    .post-header { background: var(--green); text-align: center; padding: 2.5rem 2rem 3rem; }
    .post-header .breadcrumb { font-size: 0.8rem; color: var(--salmon); margin-bottom: 0.5rem; }
    .post-header .breadcrumb a { color: var(--gold); text-decoration: none; }
    .post-header .breadcrumb a:hover { text-decoration: underline; }
    .post-header .date { font-size: 0.75rem; color: var(--gold); text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 0.5rem; }
    .post-header h1 { font-family: 'Anton', sans-serif; font-size: clamp(1.8rem, 4vw, 2.8rem); color: var(--cream); text-transform: uppercase; line-height: 1.05; max-width: 700px; margin: 0 auto; }
    .post-body { max-width: 680px; margin: 0 auto; padding: 3rem 2rem; }
    .post-body p { margin-bottom: 1.2rem; color: #3A3A3A; font-size: 1.05rem; }
    .post-body h2 { font-family: 'Anton', sans-serif; font-size: 1.4rem; text-transform: uppercase; color: var(--green); margin: 2.5rem 0 0.8rem; border-left: 4px solid var(--red); padding-left: 0.8rem; }
    .post-body h3 { font-family: 'Anton', sans-serif; font-size: 1.1rem; text-transform: uppercase; color: var(--green-light); margin: 1.5rem 0 0.5rem; }
    .post-body a { color: var(--red); }
    .post-body ul, .post-body ol { margin: 0 0 1.2rem 1.5rem; color: #3A3A3A; font-size: 1.05rem; }
    .post-body li { margin-bottom: 0.4rem; }
    .post-body table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; font-size: 0.95rem; }
    .post-body th { background: var(--green); color: var(--cream); padding: 0.6rem 0.8rem; text-align: left; font-family: 'Anton', sans-serif; text-transform: uppercase; letter-spacing: 0.04em; }
    .post-body td { padding: 0.6rem 0.8rem; border-bottom: 1px solid #e0d6c4; }
    .post-body tr:nth-child(even) td { background: rgba(0,0,0,0.03); }
    .post-body strong { color: var(--black); }
    .post-cta { background: var(--green-light); color: var(--cream); text-align: center; padding: 2.5rem 2rem; margin-top: 3rem; }
    .post-cta h3 { font-family: 'Anton', sans-serif; font-size: 1.4rem; text-transform: uppercase; margin-bottom: 0.6rem; }
    .post-cta p { margin-bottom: 1.2rem; opacity: 0.85; font-size: 0.95rem; }
    .post-cta .btn { display: inline-block; padding: 0.8rem 2rem; background: var(--red); color: var(--cream); font-family: 'Anton', sans-serif; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.06em; text-decoration: none; transition: transform 0.2s; }
    .post-cta .btn:hover { transform: translateY(-2px); }
    .back-link { display: block; text-align: center; padding: 1.5rem; font-size: 0.85rem; color: var(--red); text-decoration: none; }
    .back-link:hover { text-decoration: underline; }
  </style>
</head>
<body>
  ${NAV}

  <div class="post-header">
    <div class="breadcrumb"><a href="../">Home</a> / <a href="./">Blog</a> / ${escHtml(p.title)}</div>
    <div class="date">${dateStr}${category ? ' &nbsp;·&nbsp; ' + category : ''}</div>
    <h1>${escHtml(p.title)}</h1>
  </div>

  <article class="post-body">
    ${p.body || ''}
  </article>

  <a href="./" class="back-link">← Back to all posts</a>

  <div class="post-cta">
    <h3>Join the Community</h3>
    <p>Get weekly guides, event invites, and expat tips straight to your inbox.</p>
    <a href="../#newsletter" class="btn">Join Free</a>
  </div>

  <footer>
    <a href="../">Back to Home</a>
  </footer>
</body>
</html>`;
}

// ── generate blog index page ──────────────────────────────────────────────
function renderIndex(posts) {
  const items = posts.map(p => {
    const dateStr = formatDate(p.publishDate);
    const excerpt = escHtml(p.tldr || '');
    return `      <a href="${p.slug}.html" class="blog-item">
        <div class="date">${dateStr}</div>
        <h2>${escHtml(p.title)}</h2>
        <p>${excerpt}</p>
      </a>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Blog | The Dolce Vita Roma</title>
  <meta name="description" content="Stories, guides, and practical tips for expats and remote workers living in Rome.">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <meta property="og:type" content="website">
  <meta property="og:title" content="Blog | The Dolce Vita Roma">
  <meta property="og:description" content="Stories, guides, and practical tips for expats and remote workers living in Rome.">
  <meta property="og:url" content="https://dolcevitaroma.com/blog/">
  <meta property="og:image" content="https://dolcevitaroma.com/og-image.jpg">
  <meta property="og:image:alt" content="Dolce Vita Roma Blog">
  <meta property="og:site_name" content="Dolce Vita Roma">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Blog | The Dolce Vita Roma">
  <meta name="twitter:description" content="Stories, guides, and practical tips for expats and remote workers living in Rome.">
  <meta name="twitter:image" content="https://dolcevitaroma.com/og-image.jpg">
  <link rel="canonical" href="https://dolcevitaroma.com/blog/">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700&display=swap">
  <style>${SHARED_CSS}
    .page-header { background: var(--green); text-align: center; padding: 3rem 2rem; }
    .page-header h1 { font-family: 'Anton', sans-serif; font-size: clamp(2.5rem, 6vw, 4rem); color: var(--cream); text-transform: uppercase; letter-spacing: 0.04em; }
    .page-header p { color: var(--salmon); margin-top: 0.6rem; font-size: 1rem; }
    .container { max-width: 780px; margin: 0 auto; padding: 3rem 2rem; }
    .blog-list { display: flex; flex-direction: column; gap: 1rem; }
    .blog-item { background: var(--white); border-left: 4px solid var(--red); padding: 1.4rem 1.6rem; text-decoration: none; color: inherit; transition: transform 0.2s, box-shadow 0.2s; display: block; }
    .blog-item:hover { transform: translateX(4px); box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .blog-item .date { font-size: 0.75rem; color: var(--red); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.3rem; }
    .blog-item h2 { font-family: 'Anton', sans-serif; font-size: 1.3rem; text-transform: uppercase; margin-bottom: 0.4rem; }
    .blog-item p { font-size: 0.9rem; color: #666; }
  </style>
</head>
<body>
  <nav>
    <a href="../" class="logo-link"><img src="../images/logo.png" alt="Logo" width="32" height="32"><span class="logo-text">Dolce Vita Roma</span></a>
    <button class="nav-toggle" onclick="document.querySelector('nav ul').classList.toggle('open')" aria-label="Toggle menu"><span></span><span></span><span></span></button>
    <ul>
      <li><a href="../">Blog</a></li>
      <li><a href="https://dolcevitaroma.com" target="_blank">Main Site</a></li>
      <li><a href="https://dolcevitaroma.com/contact" target="_blank">Contact</a></li>
      <li><a href="./">Blog</a></li>
      <li><a href="../#newsletter">Join</a></li>
    </ul>
  </nav>

  <div class="page-header">
    <h1>Blog</h1>
    <p>Stories, guides, and updates from the community.</p>
  </div>

  <div class="container">
    <div class="blog-list">
${items}
    </div>
  </div>

  <footer>
    <a href="../">Back to Home</a>
  </footer>
</body>
</html>`;
}

// ── write files ───────────────────────────────────────────────────────────
let written = 0;
posts.forEach(p => {
  if (!p.slug) return;
  const html = renderPost(p);
  fs.writeFileSync(path.join(OUT_DIR, `${p.slug}.html`), html, 'utf8');
  written++;
});

// write index
fs.writeFileSync(path.join(OUT_DIR, 'index.html'), renderIndex(posts), 'utf8');

console.log(`Generated ${written} post pages + index.html`);
console.log(`Output: ${OUT_DIR}`);
