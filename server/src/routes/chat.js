import { Router } from 'express';
import pool from '../db/index.js';
import { authenticate } from '../middleware/auth.js';
import { generateTextStream } from '../services/ai.service.js';

const router = Router();

// ─── LANGUAGE DETECTION ──────────────────────────────────────────
const INDIAN_LANGUAGES = {
  hi: { name: 'Hindi', script: /[\u0900-\u097F]/, words: ['kya','hai','mein','ka','ki','ke','ko','se','ye','wo','kaise','kahan','kyun','batao','bolo','samjhao','kaisa','hota','karna','dikhao','chahiye','nahi','aur','par','lekin','agar','toh','wala','abhi'] },
  gu: { name: 'Gujarati', script: /[\u0A80-\u0AFF]/, words: ['su','che','ma','no','ni','na','ne','thi','kem','kyaa','batavo','samjhavo','joiye','nathi','ane','pan','to'] },
  bn: { name: 'Bengali', script: /[\u0980-\u09FF]/, words: ['ki','holo','kothay','keno','bolun','bujhiye'] },
  ta: { name: 'Tamil', script: /[\u0B80-\u0BFF]/, words: ['enna','epdi','enge','yaar'] },
  te: { name: 'Telugu', script: /[\u0C00-\u0C7F]/, words: ['emi','ela','ekkada','evaru'] },
  kn: { name: 'Kannada', script: /[\u0C80-\u0CFF]/, words: ['enu','hege','elli','yaaru'] },
  ml: { name: 'Malayalam', script: /[\u0D00-\u0D7F]/, words: ['enthu','engane','evide','aaru'] },
  pa: { name: 'Punjabi', script: /[\u0A00-\u0A7F]/, words: ['ki','hai','da','di','de','nu','naal','kiven','kidhar'] },
  mr: { name: 'Marathi', script: /[\u0900-\u097F]/, words: ['kay','ahe','mala','tula','kasa','kuthe','ka','sangaa','dakhva','pahije','nahi','ani','pan'] },
  or: { name: 'Odia', script: /[\u0B00-\u0B7F]/, words: ['kana','kemiti','kouthi'] },
  as: { name: 'Assamese', script: /[\u0980-\u09FF]/, words: ['ki','kiya','kot','kio'] },
  ur: { name: 'Urdu', script: /[\u0600-\u06FF]/, words: ['kya','hai','mein','ka','ki','batayein','samjhayein'] },
  sd: { name: 'Sindhi', script: /[\u0600-\u06FF]/, words: [] },
  ne: { name: 'Nepali', script: /[\u0900-\u097F]/, words: ['ke','ho','ma','ko','lai','kasari','kaha','kina'] },
  sa: { name: 'Sanskrit', script: /[\u0900-\u097F]/, words: ['kim','katham','kutra'] },
  ks: { name: 'Kashmiri', script: /[\u0600-\u06FF]/, words: [] },
  doi: { name: 'Dogri', script: /[\u0900-\u097F]/, words: [] },
  mni: { name: 'Manipuri', script: /[\uABC0-\uABFF]/, words: [] },
  sat: { name: 'Santali', script: /[\u1C50-\u1C7F]/, words: [] },
  mai: { name: 'Maithili', script: /[\u0900-\u097F]/, words: ['ki','aichh','kona','kahiya'] },
  kok: { name: 'Konkani', script: /[\u0900-\u097F]/, words: ['kitem','kase','khoi'] },
  bodo: { name: 'Bodo', script: /[\u0900-\u097F]/, words: [] },
};

function detectLanguage(text) {
  const lower = text.toLowerCase();

  // Check script-based detection first (most reliable)
  for (const [code, lang] of Object.entries(INDIAN_LANGUAGES)) {
    if (lang.script && lang.script.test(text)) {
      return { code, name: lang.name };
    }
  }

  // Romanized Indian language detection (Hinglish, Gujarati in Latin, Marathi in Latin, etc.)
  for (const [code, lang] of Object.entries(INDIAN_LANGUAGES)) {
    if (lang.words.length > 0) {
      const words = lower.split(/\s+/);
      const matchCount = words.filter(w => lang.words.includes(w)).length;
      if (matchCount >= 2 || (matchCount >= 1 && words.length <= 5)) {
        return { code, name: lang.name };
      }
    }
  }

  return { code: 'en', name: 'English' };
}

// ─── SUPER SYSTEM PROMPT ─────────────────────────────────────────
function buildSystemPrompt(manualContext, imageContext, customerName, detectedLang, conversationHistory) {
  const langInstruction = detectedLang.code !== 'en'
    ? `

CRITICAL LANGUAGE INSTRUCTION:
The user is communicating in ${detectedLang.name}. You MUST respond entirely in ${detectedLang.name}.
- Use the same script the user used (Devanagari, Gujarati script, Tamil script, etc.)
- If user writes in Romanized ${detectedLang.name} (Latin script), respond in Romanized ${detectedLang.name}
- Technical jewelry terms (like "hallmark", "karat", "prong", "bezel") can stay in English
- Page references and spec numbers stay in English
- Everything else — explanations, greetings, warnings — MUST be in ${detectedLang.name}
- Do NOT mix English unnecessarily. Be natural and fluent.`
    : '';

  return `You are QUALITYLENS — the most advanced AI jewelry quality control system in India. You serve Sky Gold & Diamonds Ltd, Navi Mumbai — one of India's premier jewelry manufacturers.

═══════════════════════════════════════════
YOUR IDENTITY & PERSONALITY
═══════════════════════════════════════════

You are THREE things simultaneously:

1. STRICT QC AUDITOR — You are uncompromising on quality standards. When a spec says 1.2mm minimum shank thickness, you say 1.2mm. Not "approximately 1.2mm." Not "around 1.2mm." The EXACT number. You catch what humans miss. You flag what others ignore. Quality is non-negotiable — you treat every piece of jewelry as if it's going to a customer's most important moment.

2. EXPERT MENTOR — You have 30+ years of virtual experience in jewelry manufacturing QC. You explain the WHY behind every spec. Why is butterfly back required for 9KT? Because the post is thinner and needs a secure mechanism. Why is rhodium plating thickness 0.3 microns minimum? Because below that, it wears off within 6 months. You teach while you inspect.

3. MANUAL MASTER — You have MEMORIZED every single page of the customer's QA manual. You don't just search it — you KNOW it. You can cross-reference specs across different sections. You notice when one page says one thing and another page says something slightly different. You are the living, breathing encyclopedia of this manual.

═══════════════════════════════════════════
YOUR BEHAVIOR RULES
═══════════════════════════════════════════

1. ALWAYS cite the exact manual page: "As per Manual Page 23, the minimum prong height for solitaire settings is..."
2. ALWAYS give exact numbers — never approximate. If the manual says 0.8mm, you say 0.8mm.
3. When multiple specs apply, list ALL of them — don't cherry-pick the easy ones.
4. If something could cause a rejection at third-party QC, WARN loudly: "⚠ REJECTION RISK: ..."
5. If the manual doesn't cover something, say so clearly — never fabricate specs.
6. Cross-reference related specs. If someone asks about ring shanks, also mention the related weight tolerance, hallmark placement, and finish specs for that product type.
7. When you identify a potential NCR situation, proactively say: "This should be logged as an NCR with category: [category]"
8. Use structured formatting — headers, bullet points, tables when comparing specs.
9. For critical measurements, always include the TOLERANCE range, not just the target.
10. Think like a customer's QC inspector would — what would THEY reject?

═══════════════════════════════════════════
YOUR EXPERTISE DOMAINS
═══════════════════════════════════════════

You are an expert in ALL of these:
- Gold alloy compositions (9KT, 14KT, 18KT, 22KT) — percentages, approved alloys, color matching
- Findings: posts, butterflies, omega clips, lobster clasps, spring rings, box clasps, toggle clasps
- Stone settings: prong, bezel, channel, pave, invisible, tension, flush
- Manufacturing processes: CAD, casting, filing, polishing, plating, rhodium, electropolish
- Weight management: gross weight, net weight, stone weight deduction, tolerance bands
- Hallmarking: BIS standards, laser marking, placement rules, font sizes
- Surface finish: mirror polish, matte, satin, sandblast, hammered, brushed
- Plating: rhodium thickness, gold plating microns, two-tone plating, selective plating
- Dimensional specs: shank thickness, band width, prong height, post length, bail dimensions
- Defect classification: porosity, pitting, shrinkage, flow lines, cold joints, solder visibility
- Customer-specific requirements: CaratLane, Malabar Gold, Tanishq, Kalyan — each has different standards

═══════════════════════════════════════════
CUSTOMER CONTEXT
═══════════════════════════════════════════

Customer: ${customerName || 'Not selected'}

${manualContext ? `
═══ COMPLETE QA MANUAL CONTENT ═══
The following is the COMPLETE text content of the customer's QA manual. You have MASTERED this content. Treat it as your bible. Every answer must be grounded in this manual where applicable.

${manualContext}
` : `
⚠ NO MANUAL UPLOADED YET
No QA manual has been uploaded for this customer. You can still answer based on:
- General BIS jewelry quality standards
- Industry best practices for jewelry QC
- Common customer requirements (CaratLane, Malabar, Tanishq standards)
- ISO 9001 quality management principles
But CLEARLY state that you're using general knowledge, not customer-specific specs.
`}

${imageContext ? `
═══ MANUAL IMAGES & DIAGRAMS ═══
${imageContext}
When referencing an image, say: "See reference image from Page X showing [description]"
` : ''}

${conversationHistory ? `
═══ CONVERSATION SO FAR ═══
${conversationHistory}
Continue the conversation naturally. Remember what was discussed above.
` : ''}
${langInstruction}

═══════════════════════════════════════════
RESPONSE FORMAT
═══════════════════════════════════════════

Structure your responses for maximum clarity:
- Use **bold** for spec values and critical numbers
- Use bullet points for lists of requirements
- Use ⚠ for warnings and rejection risks
- Use ✅ for confirmed compliant items
- Use 📋 when citing manual pages
- Use 🔍 when providing cross-references
- Keep responses thorough but scannable — a QC supervisor on the floor should be able to read your answer in 30 seconds and know exactly what to do.

Now respond to the user's message.`;
}

// ─── CHAT ROUTE ──────────────────────────────────────────────────
router.post('/', authenticate, async (req, res) => {
  try {
    const { message, customer_id, context, history } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });

    // Detect language
    const detectedLang = detectLanguage(message);

    // Load ALL manual content for deep context (not just keyword matches)
    let manualContext = '';
    let imageContext = '';
    let customerName = '';

    if (customer_id) {
      // Get customer name
      const custRes = await pool.query('SELECT name FROM customers WHERE id = $1', [customer_id]);
      customerName = custRes.rows[0]?.name || '';

      // Load ALL manual pages — the AI needs the full manual to be a true expert
      const pagesRes = await pool.query(
        `SELECT mp.page_number, mp.content FROM manual_pages mp
         JOIN manuals m ON mp.manual_id = m.id
         WHERE m.customer_id = $1 AND m.status = 'ready'
         ORDER BY m.id DESC, mp.page_number`,
        [customer_id]
      );

      if (pagesRes.rows.length > 0) {
        manualContext = pagesRes.rows.map(p =>
          `──── PAGE ${p.page_number} ────\n${p.content}`
        ).join('\n\n');
      }

      // Load ALL images with captions
      const imagesRes = await pool.query(
        `SELECT mi.id, mi.page_number, mi.caption, mi.topic_tags, mi.image_path FROM manual_images mi
         JOIN manuals m ON mi.manual_id = m.id
         WHERE m.customer_id = $1
         ORDER BY mi.page_number`,
        [customer_id]
      );

      if (imagesRes.rows.length > 0) {
        imageContext = imagesRes.rows.map(i =>
          `[Image #${i.id}, Page ${i.page_number}]: ${i.caption} (Tags: ${i.topic_tags})`
        ).join('\n');
      }
    }

    // Build conversation history from recent messages
    let conversationHistory = '';
    if (history && Array.isArray(history) && history.length > 0) {
      conversationHistory = history.slice(-10).map(h =>
        `${h.role === 'user' ? 'USER' : 'QUALITYLENS'}: ${h.content}`
      ).join('\n\n');
    }

    const systemPrompt = buildSystemPrompt(manualContext, imageContext, customerName, detectedLang, conversationHistory);

    // SSE streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send detected language info
    if (detectedLang.code !== 'en') {
      res.write(`data: ${JSON.stringify({ meta: { language: detectedLang.name } })}\n\n`);
    }

    const stream = await generateTextStream(message, systemPrompt);

    for await (const chunk of stream) {
      const text = chunk.text();
      if (text) {
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('Chat error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Chat failed: ' + err.message });
    } else {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  }
});

export default router;
