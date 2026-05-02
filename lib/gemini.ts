import { GoogleGenerativeAI, type Part, type Schema, SchemaType } from "@google/generative-ai";
import { getGeminiApiKey } from "@/lib/env";
import { retry } from "@/lib/utils";

const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";

function getClient() {
  return new GoogleGenerativeAI(getGeminiApiKey());
}

export const defaultIssueSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    summary: { type: SchemaType.STRING },
    issues: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          title: { type: SchemaType.STRING },
          description: { type: SchemaType.STRING },
          fixSuggestion: { type: SchemaType.STRING },
          severity: { type: SchemaType.STRING, enum: ["critical", "medium", "low"] },
          impact: { type: SchemaType.STRING },
          effort: { type: SchemaType.STRING }
        },
        required: ["title", "description", "fixSuggestion", "severity", "impact", "effort"]
      }
    },
    passedChecks: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING }
    },
    wins: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING }
    }
  },
  required: ["summary", "issues"]
};

export async function generateJson<T>(prompt: string, parts: Part[] = [], schema?: Schema) {
  return retry(async () => {
    const client = getClient();
    const model = client.getGenerativeModel({
      model: DEFAULT_GEMINI_MODEL,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema
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
