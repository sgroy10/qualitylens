import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function generateText(prompt, systemPrompt = '') {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
  const result = await model.generateContent(fullPrompt);
  return result.response.text();
}

export async function generateTextStream(prompt, systemPrompt = '') {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
  const result = await model.generateContentStream(fullPrompt);
  return result.stream;
}

export async function analyzeImage(imageBuffer, mimeType, prompt) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const imagePart = {
    inlineData: {
      data: imageBuffer.toString('base64'),
      mimeType: mimeType || 'image/png'
    }
  };
  const result = await model.generateContent([prompt, imagePart]);
  return result.response.text();
}

export async function parseJSON(prompt, systemPrompt = '') {
  const text = await generateText(prompt, systemPrompt);
  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
  try {
    return JSON.parse(jsonMatch[1].trim());
  } catch (e) {
    // Try to find JSON array or object directly
    const arrMatch = text.match(/\[[\s\S]*\]/);
    const objMatch = text.match(/\{[\s\S]*\}/);
    if (arrMatch) return JSON.parse(arrMatch[0]);
    if (objMatch) return JSON.parse(objMatch[0]);
    throw new Error('Failed to parse AI response as JSON: ' + text.substring(0, 200));
  }
}
