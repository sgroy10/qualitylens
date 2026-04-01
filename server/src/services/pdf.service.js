import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import pdfParse from 'pdf-parse';
import pool from '../db/index.js';
import { analyzeImage } from './ai.service.js';

const execAsync = promisify(exec);

export async function processManual(manualId, filePath) {
  try {
    console.log(`Processing manual ${manualId}: ${filePath}`);

    // Read PDF
    const pdfBuffer = await fs.readFile(filePath);
    const pdfData = await pdfParse(pdfBuffer);

    // Update total pages
    await pool.query('UPDATE manuals SET total_pages = $1 WHERE id = $2', [pdfData.numpages, manualId]);

    // Store text per page - pdf-parse gives all text together, so we split by form feeds or estimate
    const fullText = pdfData.text;
    const pages = fullText.split(/\f/).filter(p => p.trim());

    for (let i = 0; i < pages.length; i++) {
      const pageContent = pages[i].trim();
      if (!pageContent) continue;

      // Extract keywords from page content
      const keywords = extractKeywords(pageContent);

      await pool.query(
        'INSERT INTO manual_pages (manual_id, page_number, content, embedding_keywords) VALUES ($1, $2, $3, $4)',
        [manualId, i + 1, pageContent, keywords]
      );
    }

    // If only one "page" from text, store as page 1
    if (pages.length === 0 && fullText.trim()) {
      await pool.query(
        'INSERT INTO manual_pages (manual_id, page_number, content, embedding_keywords) VALUES ($1, $2, $3, $4)',
        [manualId, 1, fullText.trim(), extractKeywords(fullText)]
      );
    }

    // Extract images using pdfimages (poppler-utils)
    const imageDir = path.join(process.env.STORAGE_PATH || './storage', 'manuals', String(manualId), 'images');
    await fs.mkdir(imageDir, { recursive: true });

    try {
      await execAsync(`pdfimages -png "${filePath}" "${path.join(imageDir, 'img')}"`);

      // Process extracted images
      const imageFiles = await fs.readdir(imageDir);
      const pngFiles = imageFiles.filter(f => f.endsWith('.png')).sort();
      const totalImages = pngFiles.length;
      const totalPdfPages = pdfData.numpages || 1;

      for (let imgIdx = 0; imgIdx < pngFiles.length; imgIdx++) {
        const imgFile = pngFiles[imgIdx];
        const imgPath = path.join(imageDir, imgFile);
        const imgBuffer = await fs.readFile(imgPath);

        // Skip tiny images (likely artifacts)
        if (imgBuffer.length < 5000) continue;

        // Approximate page number: distribute images proportionally across pages
        // pdfimages extracts in page order, so img-000 is from early pages, img-NNN from later
        const estimatedPage = totalImages > 0
          ? Math.max(1, Math.ceil(((imgIdx + 1) / totalImages) * totalPdfPages))
          : 1;

        let caption = '';
        let topicTags = '';

        try {
          const aiResponse = await analyzeImage(
            imgBuffer,
            'image/png',
            'This is an image from a jewelry QA manual. Describe what this image shows in 1-2 sentences. Then list 3-5 topic tags (comma-separated) like: finding type, product type, measurement, dimension, defect type, etc. Format: CAPTION: [description] TAGS: [tag1, tag2, tag3]'
          );

          const captionMatch = aiResponse.match(/CAPTION:\s*(.*?)(?:TAGS:|$)/s);
          const tagsMatch = aiResponse.match(/TAGS:\s*(.*)/s);
          caption = captionMatch ? captionMatch[1].trim() : aiResponse.substring(0, 200);
          topicTags = tagsMatch ? tagsMatch[1].trim() : '';
        } catch (err) {
          console.error(`Failed to caption image ${imgFile}:`, err.message);
          caption = 'Image from QA manual';
        }

        // Store relative path
        const relativePath = `/storage/manuals/${manualId}/images/${imgFile}`;

        await pool.query(
          'INSERT INTO manual_images (manual_id, page_number, image_path, caption, topic_tags) VALUES ($1, $2, $3, $4, $5)',
          [manualId, estimatedPage, relativePath, caption, topicTags]
        );
      }
    } catch (err) {
      console.log('pdfimages not available or failed:', err.message);
      // Continue without image extraction - not critical
    }

    // Mark as ready
    await pool.query('UPDATE manuals SET status = $1 WHERE id = $2', ['ready', manualId]);
    console.log(`Manual ${manualId} processing complete`);
  } catch (err) {
    console.error(`Manual processing failed for ${manualId}:`, err);
    await pool.query('UPDATE manuals SET status = $1 WHERE id = $2', ['error', manualId]);
  }
}

function extractKeywords(text) {
  const commonWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'shall', 'would', 'should', 'may', 'might', 'must', 'can', 'could', 'of', 'in', 'to', 'for', 'with', 'on', 'at', 'from', 'by', 'as', 'or', 'and', 'not', 'no', 'but', 'if', 'than', 'that', 'this', 'it', 'its', 'all', 'any', 'each', 'every', 'both', 'such']);

  const words = text.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
  const freq = {};
  words.forEach(w => {
    if (!commonWords.has(w)) freq[w] = (freq[w] || 0) + 1;
  });

  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([w]) => w)
    .join(', ');
}
