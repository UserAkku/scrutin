import { GoogleGenerativeAI, type Part } from "@google/generative-ai";
import { getGeminiApiKey } from "@/lib/env";
import { retry } from "@/lib/utils";

const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";

function getClient() {
  return new GoogleGenerativeAI(getGeminiApiKey());
}

export async function generateJson<T>(prompt: string, parts: Part[] = []) {
  return retry(async () => {
    const client = getClient();
    const model = client.getGenerativeModel({
      model: DEFAULT_GEMINI_MODEL,
      generationConfig: {
        responseMimeType: "application/json"
      }
    });

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }, ...parts]
        }
      ]
    });

    const text = result.response.text();
    return JSON.parse(text) as T;
  }, 2);
}

export async function generateText(prompt: string) {
  return retry(async () => {
    const client = getClient();
    const model = client.getGenerativeModel({ model: DEFAULT_GEMINI_MODEL });
    const result = await model.generateContent(prompt);
    return result.response.text();
  }, 2);
}

export async function fetchImageAsInlinePart(imageUrl: string): Promise<Part> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Image fetch failed: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const mimeType = response.headers.get("content-type") ?? "image/png";

  return {
    inlineData: {
      mimeType,
      data: Buffer.from(arrayBuffer).toString("base64")
    }
  };
}
