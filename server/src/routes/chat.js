import { Router } from 'express';
import pool from '../db/index.js';
import { authenticate } from '../middleware/auth.js';
import { generateTextStream } from '../services/ai.service.js';

const router = Router();

router.post('/', authenticate, async (req, res) => {
  try {
    const { message, customer_id, context } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });

    // Search manual pages for relevant content
    const keywords = message.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    let manualContext = '';

    if (customer_id) {
      const pagesRes = await pool.query(
        `SELECT mp.page_number, mp.content FROM manual_pages mp
         JOIN manuals m ON mp.manual_id = m.id
         WHERE m.customer_id = $1 AND m.status = 'ready'
         ORDER BY mp.page_number`,
        [customer_id]
      );

      // Simple keyword relevance scoring
      const scored = pagesRes.rows.map(page => {
        const content = page.content.toLowerCase();
        const score = keywords.filter(k => content.includes(k)).length;
        return { ...page, score };
      }).filter(p => p.score > 0).sort((a, b) => b.score - a.score).slice(0, 10);

      if (scored.length > 0) {
        manualContext = scored.map(p => `[Page ${p.page_number}]\n${p.content}`).join('\n\n---\n\n');
      }

      // Search images
      const imagesRes = await pool.query(
        `SELECT mi.id, mi.page_number, mi.caption, mi.topic_tags, mi.image_path FROM manual_images mi
         JOIN manuals m ON mi.manual_id = m.id
         WHERE m.customer_id = $1`,
        [customer_id]
      );

      const relevantImages = imagesRes.rows.filter(img => {
        const tags = (img.topic_tags || '').toLowerCase();
        return keywords.some(k => tags.includes(k));
      }).slice(0, 5);

      if (relevantImages.length > 0) {
        manualContext += '\n\nRELEVANT IMAGES:\n' + relevantImages.map(i =>
          `Image ID ${i.id} (Page ${i.page_number}): ${i.caption} [Tags: ${i.topic_tags}]`
        ).join('\n');
      }
    }

    const systemPrompt = `You are QualityLens AI, a jewelry quality control expert assistant for Sky Gold & Diamonds. You have access to the customer's QA manual content. Answer questions about specifications, tolerances, findings, measurements, and quality requirements. Always cite the manual page number. Be specific and practical. When you mention a specification, give the exact number or measurement.

${manualContext ? `CUSTOMER QA MANUAL CONTEXT:\n${manualContext}` : 'No manual content available for this customer yet.'}

${context ? `ADDITIONAL CONTEXT:\n${context}` : ''}`;

    // SSE streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

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
