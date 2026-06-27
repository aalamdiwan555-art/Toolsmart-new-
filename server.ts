import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { 
  getToolBySlug, 
  searchAndPaginateTools, 
  getProceduralToolsCount, 
  PLATFORMS, 
  DIMENSIONS, 
  BASES 
} from "./src/toolsRegistry";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON parsing
  app.use(express.json());

  // ---------------------------------------------------------------------
  // USER STORAGE & AUTH SYSTEM (In-Memory persistent storage with Demo Account)
  // ---------------------------------------------------------------------
  interface User {
    email: string;
    passwordHash: string;
    favorites: string[];
    recents: string[];
  }

  const users: Record<string, User> = {};

  // Seed a friendly demo account for instant testability
  users["demo@example.com"] = {
    email: "demo@example.com",
    passwordHash: "password123",
    favorites: [
      "multiplication-table-of-7",
      "secure-16-character-password-generator",
      "binary-to-decimal-converter"
    ],
    recents: [
      "celsius-to-fahrenheit-converter",
      "15-percent-tip-calculator"
    ]
  };

  // ---------------------------------------------------------------------
  // DIRECT ADVERTISING CAMPAIGNS DATABASE
  // ---------------------------------------------------------------------
  interface AdCampaign {
    id: string;
    advertiser: string;
    title: string;
    description: string;
    targetUrl: string;
    bgColor: string;
    textColor: string;
    icon: string;
    status: "active" | "paused";
    budget: number;
    cpm: number;
    impressions: number;
    clicks: number;
    spent: number;
  }

  const adCampaigns: AdCampaign[] = [
    {
      id: "vps-hostsmart",
      advertiser: "sales@hostsmart.com",
      title: "Toolsmart Cloud VPS - Special 60% Off",
      description: "Get serverless edge database nodes optimized for high-performance dynamic SEO utility hubs. Fast, unmetered, from $4.99/mo.",
      targetUrl: "https://toolsmart.com/hosting-special",
      bgColor: "#f0fdf4", // emerald-50
      textColor: "#15803d", // emerald-700
      icon: "⚡",
      status: "active",
      budget: 500,
      cpm: 4.50,
      impressions: 24800,
      clicks: 842,
      spent: 111.60
    },
    {
      id: "ai-copypilot",
      advertiser: "hello@copypilot.ai",
      title: "AI Paragraph Generator & Auto-Meta Copywriter",
      description: "Instantly write 10,000 highly structured mathematical explanations, SEO descriptions, and title hooks. Built for scaling search visibility.",
      targetUrl: "https://copypilot.ai/pseo-special",
      bgColor: "#eff6ff", // blue-50
      textColor: "#1d4ed8", // blue-700
      icon: "✍️",
      status: "active",
      budget: 350,
      cpm: 6.00,
      impressions: 12500,
      clicks: 491,
      spent: 75.00
    },
    {
      id: "auth-shield",
      advertiser: "security@shield.io",
      title: "Secure JWT Authentication SDK - Built for Portals",
      description: "Single sign-on, token rotation, and local session sync for web utilities. Ready-made UI with zero latency. 100% free sandbox.",
      targetUrl: "https://shield.io/auth-sdk",
      bgColor: "#faf5ff", // purple-50
      textColor: "#7e22ce", // purple-700
      icon: "🛡️",
      status: "active",
      budget: 200,
      cpm: 3.80,
      impressions: 8900,
      clicks: 194,
      spent: 33.82
    }
  ];

  // Helper to extract email from Auth token
  function getUserFromToken(authHeader?: string): User | null {
    if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
    try {
      const token = authHeader.split(" ")[1];
      const email = Buffer.from(token, "base64").toString("utf-8");
      return users[email] || null;
    } catch {
      return null;
    }
  }

  // 1. Register User
  app.post("/api/auth/register", (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    const normEmail = email.toLowerCase().trim();
    if (users[normEmail]) {
      return res.status(400).json({ error: "Email is already registered" });
    }
    users[normEmail] = {
      email: normEmail,
      passwordHash: password,
      favorites: [],
      recents: []
    };
    const token = Buffer.from(normEmail).toString("base64");
    res.json({ token, email: normEmail, favorites: [], recents: [] });
  });

  // 2. Login User
  app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    const normEmail = email.toLowerCase().trim();
    const user = users[normEmail];
    if (!user || user.passwordHash !== password) {
      return res.status(400).json({ error: "Invalid email or password" });
    }
    const token = Buffer.from(normEmail).toString("base64");
    res.json({ token, email: normEmail, favorites: user.favorites, recents: user.recents });
  });

  // 3. Get Me User Context
  app.get("/api/auth/me", (req, res) => {
    const user = getUserFromToken(req.headers.authorization);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    res.json({ email: user.email, favorites: user.favorites, recents: user.recents });
  });

  // 4. Toggle Bookmark Favorite
  app.post("/api/user/favorites/toggle", (req, res) => {
    const user = getUserFromToken(req.headers.authorization);
    const { slug } = req.body;
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    if (!slug) return res.status(400).json({ error: "Missing tool slug" });

    const idx = user.favorites.indexOf(slug);
    if (idx >= 0) {
      user.favorites.splice(idx, 1);
    } else {
      user.favorites.push(slug);
    }
    res.json({ favorites: user.favorites });
  });

  // 5. Add Recently Viewed
  app.post("/api/user/recents/add", (req, res) => {
    const user = getUserFromToken(req.headers.authorization);
    const { slug } = req.body;
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    if (!slug) return res.status(400).json({ error: "Missing tool slug" });

    // Clean duplicates and prepend
    const idx = user.recents.indexOf(slug);
    if (idx >= 0) {
      user.recents.splice(idx, 1);
    }
    user.recents.unshift(slug);
    if (user.recents.length > 12) {
      user.recents.pop();
    }
    res.json({ recents: user.recents });
  });

  // ---------------------------------------------------------------------
  // DIRECT ADVERTISING SYSTEM API
  // ---------------------------------------------------------------------
  app.get("/api/ads/campaigns", (req, res) => {
    res.json({ campaigns: adCampaigns });
  });

  app.post("/api/ads/campaigns", (req, res) => {
    const { title, description, targetUrl, bgColor, textColor, icon, budget, cpm, advertiser } = req.body;
    if (!title || !description || !targetUrl) {
      return res.status(400).json({ error: "Title, description, and Target URL are required" });
    }
    const newAd: AdCampaign = {
      id: "ad-" + Math.random().toString(36).substring(2, 11),
      advertiser: advertiser || "guest@toolsmart.com",
      title: String(title).trim(),
      description: String(description).trim(),
      targetUrl: String(targetUrl).trim(),
      bgColor: String(bgColor || "#f8fafc").trim(),
      textColor: String(textColor || "#334155").trim(),
      icon: String(icon || "🎁").trim(),
      status: "active",
      budget: Number(budget) || 100,
      cpm: Number(cpm) || 3.00,
      impressions: 0,
      clicks: 0,
      spent: 0
    };
    adCampaigns.push(newAd);
    res.json({ success: true, campaign: newAd, campaigns: adCampaigns });
  });

  app.post("/api/ads/campaigns/toggle", (req, res) => {
    const { id } = req.body;
    const campaign = adCampaigns.find(c => c.id === id);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    campaign.status = campaign.status === "active" ? "paused" : "active";
    res.json({ success: true, campaign, campaigns: adCampaigns });
  });

  app.post("/api/ads/campaigns/delete", (req, res) => {
    const { id } = req.body;
    const idx = adCampaigns.findIndex(c => c.id === id);
    if (idx === -1) return res.status(404).json({ error: "Campaign not found" });
    adCampaigns.splice(idx, 1);
    res.json({ success: true, campaigns: adCampaigns });
  });

  app.post("/api/ads/campaigns/click", (req, res) => {
    const { id } = req.body;
    const campaign = adCampaigns.find(c => c.id === id);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    campaign.clicks += 1;
    res.json({ success: true, campaign });
  });

  app.post("/api/ads/campaigns/impress", (req, res) => {
    const { id } = req.body;
    const campaign = adCampaigns.find(c => c.id === id);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    campaign.impressions += 1;
    campaign.spent = Number(((campaign.impressions / 1000) * campaign.cpm).toFixed(2));
    if (campaign.spent >= campaign.budget) {
      campaign.status = "paused";
    }
    res.json({ success: true, campaign });
  });

  app.post("/api/ads/campaigns/simulate", (req, res) => {
    adCampaigns.forEach(c => {
      if (c.status === "active" && c.spent < c.budget) {
        const addedImps = Math.floor(Math.random() * 500) + 120;
        const ctr = (Math.random() * 4.2 + 1.8) / 100; 
        const addedClicks = Math.floor(addedImps * ctr) || 1;
        
        c.impressions += addedImps;
        c.clicks += addedClicks;
        c.spent = Number(((c.impressions / 1000) * c.cpm).toFixed(2));
        if (c.spent >= c.budget) {
          c.spent = c.budget;
          c.status = "paused";
        }
      }
    });
    res.json({ success: true, campaigns: adCampaigns });
  });

  app.post("/api/ads/campaigns/reset", (req, res) => {
    adCampaigns.forEach(c => {
      c.impressions = 0;
      c.clicks = 0;
      c.spent = 0;
      c.status = "active";
    });
    res.json({ success: true, campaigns: adCampaigns });
  });

  // ---------------------------------------------------------------------
  // 1. API ENDPOINTS
  // ---------------------------------------------------------------------

  // Dynamic Tools Lookup API
  app.get("/api/tools", (req, res) => {
    const search = String(req.query.search || "");
    const category = String(req.query.category || "all");
    const page = parseInt(String(req.query.page || "1")) || 1;
    const limit = parseInt(String(req.query.limit || "20")) || 20;

    try {
      const result = searchAndPaginateTools(search, category, page, limit);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Dynamic Stats API
  app.get("/api/stats", (req, res) => {
    res.json({
      totalTools: getProceduralToolsCount(),
      categories: ["converters", "math", "finance", "content", "developer", "security"]
    });
  });

  // ---------------------------------------------------------------------
  // 2. DYNAMIC SEO SITEMAPS (To index all 110,742 tools)
  // ---------------------------------------------------------------------
  app.get("/sitemap.xml", (req, res) => {
    // Generate sitemap index for 110k tools
    const totalSitemaps = Math.ceil(getProceduralToolsCount() / 25000);
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
    for (let i = 1; i <= totalSitemaps; i++) {
      xml += `  <sitemap>\n    <loc>https://toolhub.pSEO.app/sitemaps/sitemap-${i}.xml</loc>\n  </sitemap>\n`;
    }
    xml += `</sitemapindex>`;
    res.header("Content-Type", "application/xml");
    res.send(xml);
  });

  app.get("/sitemaps/sitemap-:num.xml", (req, res) => {
    const sitemapNum = parseInt(req.params.num);
    if (isNaN(sitemapNum) || sitemapNum < 1 || sitemapNum > 5) {
      return res.status(404).send("Sitemap not found");
    }

    const pageSize = 25000;
    const startIdx = (sitemapNum - 1) * pageSize;
    const endIdx = startIdx + pageSize;

    // We can list a subset of slugs generated deterministically
    const urls: string[] = [];
    
    // Add Multiplication tables (1 to 50000)
    for (let n = Math.max(1, startIdx); n < Math.min(50000, endIdx); n++) {
      urls.push(`tools/multiplication-table-of-${n}.html`);
    }

    // Add Division tables (1 to 20000)
    const divOffset = 50000;
    for (let n = Math.max(1, startIdx - divOffset); n < Math.min(20000, endIdx - divOffset); n++) {
      urls.push(`tools/division-table-of-${n}.html`);
    }

    // Add Addition tables (1 to 20000)
    const addOffset = 70000;
    for (let n = Math.max(1, startIdx - addOffset); n < Math.min(20000, endIdx - addOffset); n++) {
      urls.push(`tools/addition-table-of-${n}.html`);
    }

    // Add Subtraction tables (1 to 20000)
    const subOffset = 90000;
    for (let n = Math.max(1, startIdx - subOffset); n < Math.min(20000, endIdx - subOffset); n++) {
      urls.push(`tools/subtraction-table-of-${n}.html`);
    }

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
    for (const url of urls) {
      xml += `  <url>\n    <loc>https://toolhub.pSEO.app/${url}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.6</priority>\n  </url>\n`;
    }
    xml += `</urlset>`;

    res.header("Content-Type", "application/xml");
    res.send(xml);
  });

  // ---------------------------------------------------------------------
  // 3. DYNAMIC HTML RENDERER FOR TOOLS (THE HEART OF THE pSEO SUITE)
  // ---------------------------------------------------------------------

  // Route to render the dynamically built tool page on-the-fly!
  app.get("/tools/:slug.html", (req, res) => {
    const slug = req.params.slug;
    const tool = getToolBySlug(slug);

    if (!tool) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Tool Not Found</title>
          <link rel="stylesheet" href="../styles.css">
        </head>
        <body style="font-family: sans-serif; text-align: center; padding: 5rem;">
          <h1>🛠️ SEO ToolHub</h1>
          <p style="margin-top: 1.5rem; font-size: 1.2rem; color: #475569;">The requested tool is currently compiling or does not exist.</p>
          <a href="/" class="btn" style="display: inline-block; max-width: 200px; margin-top: 2rem; text-decoration: none;">Return Home</a>
        </body>
        </html>
      `);
    }

    // Direct Advertising System: select active campaign and increment impressions in real-time
    const activeAds = adCampaigns.filter(c => c.status === "active" && c.spent < c.budget);
    const chosenAd = activeAds[Math.floor(Math.random() * activeAds.length)] || {
      id: "vps-hostsmart",
      title: "Toolsmart Cloud VPS - Special 60% Off",
      description: "Get serverless edge database nodes optimized for high-performance dynamic SEO utility hubs. Fast, unmetered, from $4.99/mo.",
      targetUrl: "https://toolsmart.com/hosting-special",
      bgColor: "#f0fdf4",
      textColor: "#15803d",
      icon: "⚡"
    };

    // Increment backend impressions
    const matchedAd = adCampaigns.find(c => c.id === chosenAd.id);
    if (matchedAd) {
      matchedAd.impressions += 1;
      matchedAd.spent = Number(((matchedAd.impressions / 1000) * matchedAd.cpm).toFixed(2));
      if (matchedAd.spent >= matchedAd.budget) {
        matchedAd.status = "paused";
      }
    }

    // Embed structure schemas
    const faqSchema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": tool.faqs.map(f => ({
        "@type": "Question",
        "name": f.q,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": f.a
        }
      }))
    };

    const breadcrumbListSchema = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": tool.breadcrumbs.map((b, i) => ({
        "@type": "ListItem",
        "position": i + 1,
        "name": b.name,
        "item": b.url ? `https://toolhub.pSEO.app${b.url}` : undefined
      }))
    };

    const relatedCardsHTML = tool.relatedLinks.map(l => `
      <a href="${l.slug}.html" class="related-card" id="rel-${l.slug}">
        <div class="related-title">${l.title}</div>
        <div class="related-desc">${l.description}</div>
      </a>
    `).join('');

    const faqsHTML = tool.faqs.map(f => `
      <div class="faq-item">
        <div class="faq-question">${f.q}</div>
        <div class="faq-answer">${f.a}</div>
      </div>
    `).join('');

    // Responsive HTML Layout
    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${tool.title} | Toolsmart Free Online Tools</title>
  <meta name="description" content="${tool.description}">
  <link rel="stylesheet" href="../styles.css">
  
  <!-- Open Graph / SEO -->
  <meta property="og:type" content="website">
  <meta property="og:title" content="${tool.title}">
  <meta property="og:description" content="${tool.description}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${tool.title}">
  <meta name="twitter:description" content="${tool.description}">
  
  <!-- Schema.org Structured Data -->
  <script type="application/ld+json">
    ${JSON.stringify(faqSchema)}
  </script>
  <script type="application/ld+json">
    ${JSON.stringify(breadcrumbListSchema)}
  </script>

  <!-- Google AdSense Official Script Integration -->
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9473850123456789" crossorigin="anonymous"></script>
</head>
<body>

  <header>
    <div class="header-container">
      <a href="/" class="logo" id="logo-link" style="display: flex; align-items: center; gap: 8px; text-decoration: none;">
        <span style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: white; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 8px; font-weight: 900; box-shadow: 0 4px 10px rgba(79, 70, 229, 0.25);">T</span>
        <span style="font-weight: 800; font-size: 1.3rem; letter-spacing: -0.03em; color: #0f172a;">Tool<span style="color: #4f46e5;">smart</span></span>
      </a>
      <div style="font-size: 0.85rem; color: #475569; font-weight: 500; display: flex; align-items: center; gap: 10px;">
        <span class="pulse-indicator"></span>
        <span>AdSense Certified Site</span>
      </div>
    </div>
  </header>

  <main class="container">
    <!-- Top Premium AdSense Unit -->
    <div class="adsense-banner-top" style="margin-bottom: 2rem; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1rem; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
      <div style="font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; margin-bottom: 8px;">Advertisement (Google AdSense Adaptive Display)</div>
      <div style="min-height: 90px; display: flex; justify-content: center; align-items: center; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px;">
        <ins class="adsbygoogle"
             style="display:block;width:100%;max-width:728px;height:90px;"
             data-ad-client="ca-pub-9473850123456789"
             data-ad-slot="1047285901"
             data-ad-format="horizontal"
             data-full-width-responsive="true"></ins>
        <script>
             (adsbygoogle = window.adsbygoogle || []).push({});
        </script>
        <div style="position: absolute; font-size: 0.8rem; color: #64748b; font-weight: 500;">
          Sponsor: <strong style="color: #4f46e5;">Toolsmart Cloud Services</strong> &bull; Need faster calculations? Connect your account today!
        </div>
      </div>
    </div>

    <div class="breadcrumb">
      <a href="/" id="bc-home">Home</a> &gt; 
      <span class="badge" style="margin: 0 0.5rem; vertical-align: middle;">${tool.category.toUpperCase()}</span> &gt; 
      <span>${tool.title}</span>
    </div>

    <div class="card" id="main-tool-card" style="border-radius:12px; position: relative;">
      <span class="badge">${tool.category.toUpperCase()} TOOL</span>
      <h1 class="card-title">${tool.title}</h1>
      <p class="card-description">${tool.description}</p>
      
      <!-- Interactive Tool UI -->
      ${tool.toolUI}
    </div>

    <!-- Direct Advertiser Sponsor Campaign (Strict Advertising System) -->
    <div class="direct-ad-banner" style="margin: 2rem 0; background: ${chosenAd.bgColor}; border: 1px solid rgba(0,0,0,0.05); border-radius: 12px; padding: 1.25rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05); cursor: pointer;" onclick="handleDirectAdClick('${chosenAd.id}', '${chosenAd.targetUrl}')">
      <div style="font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: ${chosenAd.textColor}; margin-bottom: 6px; font-weight: 700; display: flex; align-items: center; justify-content: space-between;">
        <span>Direct Partner Campaign</span>
        <span style="font-size: 8px; opacity: 0.75; font-weight: normal; background: rgba(0,0,0,0.05); padding: 2px 6px; border-radius: 4px;">AdSense Alternate</span>
      </div>
      <div style="display: flex; align-items: center; gap: 15px;">
        <div style="width: 48px; height: 48px; border-radius: 8px; background: white; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; box-shadow: 0 2px 5px rgba(0,0,0,0.05); flex-shrink: 0;">${chosenAd.icon}</div>
        <div>
          <h4 style="margin: 0; font-size: 0.95rem; font-weight: 700; color: ${chosenAd.textColor};">${chosenAd.title}</h4>
          <p style="margin: 2px 0 0; font-size: 0.8rem; color: #475569; font-weight: 500;">${chosenAd.description}</p>
        </div>
        <a href="${chosenAd.targetUrl}" target="_blank" style="margin-left: auto; background: ${chosenAd.textColor}; color: white; padding: 6px 12px; border-radius: 6px; font-size: 0.8rem; text-decoration: none; font-weight: 600; text-align: center; white-space: nowrap;" onclick="event.stopPropagation(); handleDirectAdClick('${chosenAd.id}', '${chosenAd.targetUrl}')">Visit Sponsor</a>
      </div>
    </div>

    <!-- Keyword-Rich Editorial Prose -->
    <section class="seo-section card" id="explanation-card" style="border-radius:12px;">
      <h2 class="seo-title">About ${tool.title}</h2>
      <div class="prose">
        ${tool.proseContent}
      </div>
    </section>

    <!-- FAQs Accordion -->
    <section class="seo-section card" id="faqs-card" style="border-radius:12px;">
      <h2 class="seo-title">Frequently Asked Questions</h2>
      <div class="faq-accordion">
        ${faqsHTML}
      </div>
    </section>

    <!-- Bottom Anchor AdSense Unit -->
    <div class="adsense-banner-bottom" style="margin-top: 2rem; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1rem; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
      <div style="font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; margin-bottom: 8px;">Recommended For You (AdSense Native Matching)</div>
      <div style="min-height: 90px; display: flex; justify-content: center; align-items: center; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px;">
        <ins class="adsbygoogle"
             style="display:block;width:100%;max-width:728px;height:90px;"
             data-ad-client="ca-pub-9473850123456789"
             data-ad-slot="5918294720"
             data-ad-format="horizontal"
             data-full-width-responsive="true"></ins>
        <script>
             (adsbygoogle = window.adsbygoogle || []).push({});
        </script>
        <div style="position: absolute; font-size: 0.8rem; color: #64748b; font-weight: 500;">
          Advertise here! Contact ads@toolsmart.com to drive 10M+ visitors to your platform.
        </div>
      </div>
    </div>

    <!-- Related Internal Linking -->
    <section class="seo-section" id="related-section">
      <h2 class="seo-title">Related Tools You Might Need</h2>
      <div class="related-grid">
        ${relatedCardsHTML}
      </div>
    </section>
  </main>

  <footer>
    <p>&copy; 2026 Toolsmart. 110,000+ Multi-Page Dynamic Utility Suite. Dominating Search Engine Space.</p>
    <p style="margin-top: 0.5rem; font-size: 0.75rem; color: #94a3b8;">Created fully programmatically using programmatic pSEO automation pipeline.</p>
  </footer>

  <!-- Core Tool Script -->
  <script>
    // Direct Ad Click Handler
    function handleDirectAdClick(id, targetUrl) {
      fetch('/api/ads/campaigns/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: id })
      }).catch(e => console.error('Ad click tracking failed'))
      .finally(() => {
        window.open(targetUrl, '_blank');
      });
    }

    // Copy helper
    function copyToClipboard(elementId, btnId) {
      const el = document.getElementById(elementId);
      const copyText = el.value || el.innerText;
      navigator.clipboard.writeText(copyText).then(() => {
        const btn = document.getElementById(btnId);
        if (btn) {
          const originalText = btn.innerText;
          btn.innerText = "Copied!";
          setTimeout(() => { btn.innerText = originalText; }, 2000);
        }
      });
    }
    
    ${tool.toolScript}
  </script>
</body>
</html>`;

    res.send(html);
  });

  // ---------------------------------------------------------------------
  // 4. VITE DEV SERVER OR PRODUCTION STATIC SERVING
  // ---------------------------------------------------------------------
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
