// ─── Gemini Vision OCR for Expense Receipts ──────────────────────────────────

const GEMINI_OCR_MODEL = "gemini-2.5-flash";

type GeminiOcrResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

export type OcrItem = {
  description: string;
  amount: number;
  category: string;
};

export type OcrExpenseResult = {
  currency?: string;
  merchant?: string;
  date?: string;
  items: OcrItem[];
  rawText?: string;
};

function getGeminiApiKey(): string {
  return (
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_GEMINI_API_KEY?.trim() ||
    ""
  );
}

/**
 * Extract structured itemized expense data from a receipt image using Gemini Vision.
 *
 * @param imageBase64 - Base64-encoded image data (no data URI prefix)
 * @param mimeType - MIME type of the image (e.g. "image/jpeg", "image/png")
 * @returns Structured itemized fields extracted from the receipt
 */
export async function extractExpenseFromImage(
  imageBase64: string,
  mimeType: string,
): Promise<OcrExpenseResult> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("Gemini API key is not configured. Cannot perform OCR.");
  }

  const baseUrl =
    process.env.GEMINI_BASE_URL?.trim() ||
    process.env.GOOGLE_GEMINI_BASE_URL?.trim() ||
    "https://generativelanguage.googleapis.com/v1beta";

  const url = `${baseUrl}/models/${GEMINI_OCR_MODEL}:generateContent?key=${apiKey}`;

  const prompt = `You are an expense receipt parser. Analyze this receipt image and extract the itemized list of purchases along with general receipt information as a JSON object:

{
  "currency": <currency code like "AED", "INR", "USD", "EUR" — infer from symbols or country context>,
  "merchant": <merchant/store name if visible>,
  "date": <date on the receipt in YYYY-MM-DD format if visible, otherwise null>,
  "items": [
    {
      "description": <name of the item purchased>,
      "amount": <price of the item as a number>,
      "category": <one of: "food", "groceries", "transport", "shopping", "bills", "rent", "health", "entertainment", "travel", "education", "other">
    }
  ],
  "rawText": <key text extracted from the receipt, keep it concise>
}

Rules:
- Return ONLY the JSON object, no markdown fences, no extra text.
- Do NOT include subtotal, tax, or total as items unless they are the only things you can extract. Focus on the actual purchased items.
- If a field cannot be determined, set it to null.
- For category, choose the most appropriate option from the list provided for each individual item.`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: mimeType,
                data: imageBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.error("[ocr] Gemini API error", response.status, errorText);
    throw new Error(`Gemini OCR API error: ${response.status}`);
  }

  const data = (await response.json()) as GeminiOcrResponse;

  const rawOutput =
    data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

  if (!rawOutput) {
    throw new Error("Gemini returned an empty response for the receipt image.");
  }

  // Strip markdown code fences if Gemini wraps the JSON
  const cleaned = rawOutput
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as OcrExpenseResult;
    
    // Ensure items array exists and sanitize
    const sanitizedItems: OcrItem[] = Array.isArray(parsed.items)
      ? parsed.items
          .filter((item) => typeof item.amount === "number" && item.description)
          .map((item) => ({
            description: String(item.description),
            amount: Number(item.amount),
            category: typeof item.category === "string" ? item.category.toLowerCase() : "other",
          }))
      : [];

    return {
      currency: typeof parsed.currency === "string" ? parsed.currency : undefined,
      merchant: typeof parsed.merchant === "string" ? parsed.merchant : undefined,
      date: typeof parsed.date === "string" ? parsed.date : undefined,
      items: sanitizedItems,
      rawText: typeof parsed.rawText === "string" ? parsed.rawText : undefined,
    };
  } catch {
    console.error("[ocr] Failed to parse Gemini response as JSON:", cleaned);
    // Fallback: return raw text so the user still gets something useful
    return { items: [], rawText: cleaned };
  }
}
