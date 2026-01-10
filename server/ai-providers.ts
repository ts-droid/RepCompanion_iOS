/**
 * AI Provider Service
 * Supports OpenAI, Google Gemini, and DeepSeek
 * Only one provider is active at a time (controlled by env variable)
 */

import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

export type AIProvider = "openai" | "gemini" | "deepseek" | "perplexity";

// Get active provider from environment (default: openai)
export const ACTIVE_PROVIDER: AIProvider = (process.env.AI_PROVIDER as AIProvider) || "openai";

console.log(`[AI PROVIDER] Active provider: ${ACTIVE_PROVIDER}`);

// Initialize OpenAI client
const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

// Initialize Gemini client (if API key is available)
let geminiClient: GoogleGenerativeAI | null = null;
if (process.env.GEMINI_API_KEY) {
  geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

// DeepSeek API configuration
const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// Perplexity API configuration
const PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions";
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

export interface AIRequest {
  systemPrompt: string;
  userPrompt: string;
  responseFormat?: "json" | "text";
  maxTokens?: number;
  temperature?: number;
  model?: string; // Model name (e.g., "gemini-flash-lite-latest")
}

export interface AIResponse {
  content: string;
  finishReason?: string;
}

/**
 * Call OpenAI API
 */
async function callOpenAI(request: AIRequest): Promise<AIResponse> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o", // or "gpt-4o-mini" for faster/cheaper
    messages: [
      {
        role: "system",
        content: request.systemPrompt,
      },
      {
        role: "user",
        content: request.userPrompt,
      }
    ],
    response_format: request.responseFormat === "json" ? { type: "json_object" } : undefined,
    max_tokens: request.maxTokens || 16000,
    temperature: request.temperature || 0.7,
  });

  return {
    content: response.choices[0]?.message?.content || "",
    finishReason: response.choices[0]?.finish_reason || undefined,
  };
}

/**
 * Call Google Gemini API
 * BRUTE FORCE FIX: Aggressive text extraction and model name fix
 */
async function callGemini(request: AIRequest): Promise<AIResponse> {
  const geminiStartTime = Date.now();
  console.log("[GEMINI] 🔵 Starting Gemini API call...");
  
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error("[GEMINI] ❌ ERROR: Gemini API key not configured");
    throw new Error("Missing GEMINI_API_KEY");
  }

  // Use model from request or default to gemini-flash-lite-latest (auto-updates to latest version)
  const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";
  const modelName = (request as any).model || GEMINI_MODEL;
  console.log("[GEMINI] 🤖 Model:", modelName);

  // --- DEBUGGNING (Se vad som faktiskt kommer in) ---
  console.log("🔍 [Gemini Debug] Input Type:", typeof request.userPrompt);
  if (typeof request.userPrompt === 'object') {
    console.log("🔍 [Gemini Debug] Input Content:", JSON.stringify(request.userPrompt).substring(0, 200) + "...");
  }

  // --- AGGRESSIV TEXT-EXTRAHERING ---
  let finalPrompt = "";

  if (typeof request.userPrompt === 'string') {
    finalPrompt = request.userPrompt;
  } 
  else if (request.userPrompt && typeof request.userPrompt === 'object') {
    const userObj = request.userPrompt as any;
    // Hantera OpenAI-liknande objekt { role: 'user', content: '...' }
    if (userObj.content && typeof userObj.content === 'string') {
      finalPrompt = userObj.content;
    } 
    // Hantera Gemini-liknande objekt { parts: [{ text: '...' }] }
    else if (userObj.parts && Array.isArray(userObj.parts) && userObj.parts[0]?.text) {
      finalPrompt = userObj.parts[0].text;
    }
    // Nödfall: Stringifiera hela objektet om vi inte hittar text
    else {
      console.warn("⚠️ [Gemini Warning] Could not extract text, stringifying object.");
      finalPrompt = JSON.stringify(userObj);
    }
  } else {
    finalPrompt = String(request.userPrompt);
  }

  // Kontrollera att vi inte skickar tomt
  if (!finalPrompt || finalPrompt.trim().length === 0) {
    throw new Error("Gemini Error: Prompt became empty after extraction.");
  }

  console.log("[GEMINI] 📝 Final prompt length:", finalPrompt.length, "characters");

  // Create new GoogleGenerativeAI instance (no baseUrl - SDK uses correct /v1 endpoint)
  const genAI = new GoogleGenerativeAI(apiKey);

  // Build generation config (will be passed to generateContent, not getGenerativeModel)
  const generationConfig: any = {
    temperature: request.temperature || 0.7,
  };

  // Add JSON mode if requested
  if (request.responseFormat === "json") {
    generationConfig.responseMimeType = "application/json";
    console.log("[GEMINI] 📋 JSON mode enabled");
  }

  // Add max tokens if specified
  if (request.maxTokens) {
    generationConfig.maxOutputTokens = request.maxTokens;
  }

  console.log("[GEMINI] ⚙️  Generation Config:");
  console.log("  • Temperature:", generationConfig.temperature);
  console.log("  • Max Output Tokens:", generationConfig.maxOutputTokens || "default");
  console.log("  • Response MIME Type:", generationConfig.responseMimeType || "text/plain");

  // Create model with systemInstruction only (generationConfig goes to generateContent)
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: request.systemPrompt || undefined,
  });

  console.log("[GEMINI] 📝 System instruction length:", request.systemPrompt?.length || 0, "characters");
  console.log(`🚀 [Gemini] Sending request to ${modelName}...`);
  const apiCallStartTime = Date.now();
  
  try {
    // Use contents array format (as per user specification)
    const result = await model.generateContent({
      contents: [{
        role: "user",
        parts: [{ text: finalPrompt }],
      }],
      generationConfig,
    });
    const response = result.response;
    const text = response.text();
    
    const apiCallDuration = Date.now() - apiCallStartTime;
    console.log(`[GEMINI] ⏱️  API call completed in ${apiCallDuration}ms`);

    console.log("[GEMINI] 📥 Response received:");
    console.log("  • Text length:", text.length, "characters");
    console.log("  • Finish reason:", response.candidates?.[0]?.finishReason || "unknown");
    console.log("  • First 500 chars:", text.substring(0, 500));
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("[GEMINI] 📄 FULL RAW RESPONSE (before cleaning):");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(text);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    const totalDuration = Date.now() - geminiStartTime;
    console.log(`[GEMINI] ✅ Total Gemini call time: ${totalDuration}ms`);

    // Clean JSON if needed, but always return as string for AIResponse interface
    let cleanedContent: string = text;
    if (request.responseFormat === "json") {
      // Remove markdown code blocks if present
      cleanedContent = text.trim();
      cleanedContent = cleanedContent.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
      cleanedContent = cleanedContent.replace(/^```\s*/i, '').replace(/\s*```$/, '');
    }

    return {
      content: cleanedContent,
      finishReason: response.candidates?.[0]?.finishReason || undefined,
    };
  } catch (error: any) {
    const errorDuration = Date.now() - geminiStartTime;
    console.error(`[GEMINI] ❌ ERROR after ${errorDuration}ms:`);
    console.error("❌ [Gemini Error Final]:", error.message);
    if (error.response) {
      console.error("Error details:", JSON.stringify(error.response, null, 2));
    }
    console.error("  • Error type:", error?.constructor?.name || typeof error);
    console.error("  • Error stack:", error.stack || "No stack trace");
    throw error;
  }
}

/**
 * Call DeepSeek API
 */
async function callDeepSeek(request: AIRequest): Promise<AIResponse> {
  if (!DEEPSEEK_API_KEY) {
    throw new Error("DeepSeek API key not configured");
  }

  // DeepSeek doesn't have strict JSON mode, so we add instruction to prompt
  let userPrompt = request.userPrompt;
  if (request.responseFormat === "json") {
    userPrompt += "\n\nIMPORTANT: Output ONLY the JSON object. Do not wrap in markdown code blocks. Start with '{' and end with '}'.";
  }

  const response = await fetch(DEEPSEEK_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat", // or "deepseek-reasoner" for better logic
      messages: [
        {
          role: "system",
          content: request.systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        }
      ],
      temperature: request.temperature || 0.7,
      max_tokens: request.maxTokens || 16000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as any;
  const content = data.choices?.[0]?.message?.content;

  if (!content || typeof content !== 'string') {
    throw new Error("DeepSeek returned invalid response");
  }

  return {
    content: content.trim(),
    finishReason: data.choices?.[0]?.finish_reason || undefined,
  };
}

/**
 * Call Perplexity API
 */
async function callPerplexity(request: AIRequest): Promise<AIResponse> {
  if (!PERPLEXITY_API_KEY) {
    throw new Error("Perplexity API key not configured");
  }

  // Use a default model if not specified, or fallback to a sensible default
  const model = (request as any).model && (request as any).model.includes("sonar") 
    ? (request as any).model 
    : "sonar";

  console.log(`[PERPLEXITY] 🤖 Model: ${model}`);

  const response = await fetch(PERPLEXITY_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${PERPLEXITY_API_KEY}`,
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: "system",
          content: request.systemPrompt,
        },
        {
          role: "user",
          content: request.userPrompt,
        }
      ],
      temperature: request.temperature || 0.2, // Perplexity recommends lower temperature for factual queries
      // Perplexity max_tokens logic might differ, usually returns full answer.
      // max_tokens: request.maxTokens, 
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Perplexity API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as any;
  const content = data.choices?.[0]?.message?.content;

  if (!content || typeof content !== 'string') {
    throw new Error("Perplexity returned invalid response");
  }

  return {
    content: content.trim(),
    finishReason: data.choices?.[0]?.finish_reason || undefined,
  };
}

/**
 * Determine which provider to use based on model name or ACTIVE_PROVIDER
 */
function determineProvider(model?: string): AIProvider {
  // If model name is specified, auto-detect provider from model name
  if (model) {
    if (model.includes("gemini") || model.includes("gpt")) {
      if (model.includes("gemini")) {
        console.log(`[AI PROVIDER] 🔍 Auto-detected provider: gemini (from model: ${model})`);
        return "gemini";
      } else {
        console.log(`[AI PROVIDER] 🔍 Auto-detected provider: openai (from model: ${model})`);
        return "openai";
      }
    } else if (model.includes("deepseek")) {
      console.log(`[AI PROVIDER] 🔍 Auto-detected provider: deepseek (from model: ${model})`);
      return "deepseek";
    } else if (model.includes("perplexity") || model.includes("sonar") || model.includes("llama")) {
      console.log(`[AI PROVIDER] 🔍 Auto-detected provider: perplexity (from model: ${model})`);
      return "perplexity";
    }
  }
  
  // Fall back to ACTIVE_PROVIDER if model doesn't specify
  console.log(`[AI PROVIDER] 🔍 Using configured provider: ${ACTIVE_PROVIDER} (model: ${model || "default"})`);
  return ACTIVE_PROVIDER;
}

/**
 * Get fallback providers in priority order: Gemini -> DeepSeek -> OpenAI
 */
function getFallbackProviders(primaryProvider: AIProvider): AIProvider[] {
  const fallbackOrder: AIProvider[] = ["gemini", "perplexity", "deepseek", "openai"];
  
  // Remove primary provider from fallback list
  const fallbacks = fallbackOrder.filter(p => p !== primaryProvider);
  
  // Ensure primary is first, then fallbacks
  return [primaryProvider, ...fallbacks];
}

/**
 * Call a specific provider
 */
async function callProvider(provider: AIProvider, request: AIRequest): Promise<AIResponse> {
  const providerStartTime = Date.now();
  const providerTimeout = 60000; // 60 seconds per provider attempt before switching to fallback
  
  try {
    // Create timeout for individual provider call
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Provider ${provider} TIMEOUT after ${providerTimeout}ms`));
      }, providerTimeout);
    });
    
    let providerCall: Promise<AIResponse>;
    switch (provider) {
      case "openai":
        console.log("[AI PROVIDER] 📞 Calling OpenAI...");
        providerCall = callOpenAI(request);
        break;
      case "gemini":
        console.log("[AI PROVIDER] 📞 Calling Gemini...");
        providerCall = callGemini(request);
        break;
      case "deepseek":
        console.log("[AI PROVIDER] 📞 Calling DeepSeek...");
        providerCall = callDeepSeek(request);
        break;
      case "perplexity":
        console.log("[AI PROVIDER] 📞 Calling Perplexity...");
        providerCall = callPerplexity(request);
        break;
      default:
        throw new Error(`Unknown AI provider: ${provider}`);
    }
    
    // Race between provider call and timeout
    const response = await Promise.race([providerCall, timeoutPromise]);
    const providerDuration = Date.now() - providerStartTime;
    console.log(`[AI PROVIDER] ⏱️  ${provider.toUpperCase()} completed in ${providerDuration}ms`);
    return response;
  } catch (error: any) {
    const providerDuration = Date.now() - providerStartTime;
    console.error(`[AI PROVIDER] ❌ ${provider.toUpperCase()} failed after ${providerDuration}ms`);
    throw error;
  }
}

/**
 * Main function to call the active AI provider with fallback support
 * Fallback chain: Gemini -> DeepSeek -> OpenAI
 */
export async function callAIProvider(request: AIRequest, useFallback: boolean = true): Promise<AIResponse> {
  const callStartTime = Date.now();
  const model = (request as any).model;
  
  // Determine primary provider (always Gemini first for V3)
  const primaryProvider: AIProvider = model && model.includes("gemini") ? "gemini" : determineProvider(model);
  
  // Get fallback chain: Gemini -> DeepSeek -> OpenAI
  const providers = useFallback ? getFallbackProviders(primaryProvider) : [primaryProvider];
  
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`[AI PROVIDER] 🚀 CALLING WITH FALLBACK CHAIN`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("[AI PROVIDER] 📋 Request Configuration:");
  console.log("  • Primary Provider:", primaryProvider, model ? "(auto-detected from model)" : `(from ACTIVE_PROVIDER=${ACTIVE_PROVIDER})`);
  console.log("  • Fallback Chain:", providers.join(" → "));
  console.log("  • Model:", model || "default");
  console.log("  • Temperature:", request.temperature || "default");
  console.log("  • Max Tokens:", request.maxTokens || "default");
  console.log("  • Response Format:", request.responseFormat || "text");
  console.log("  • System Prompt Length:", request.systemPrompt?.length || 0, "characters");
  console.log("  • User Prompt Length:", request.userPrompt?.length || 0, "characters");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  let lastError: any = null;
  
  // Try each provider in order
  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i];
    const isPrimary = i === 0;
    const attemptStartTime = Date.now();
    
    try {
      console.log(`[AI PROVIDER] 🔄 Attempt ${i + 1}/${providers.length}: ${provider.toUpperCase()}${isPrimary ? " (PRIMARY)" : " (FALLBACK)"}`);
      
      const response = await callProvider(provider, request);
      
      const callDuration = Date.now() - callStartTime;
      const attemptDuration = Date.now() - attemptStartTime;
      console.log(`[AI PROVIDER] ⏱️  Call completed in ${callDuration}ms (${provider} took ${attemptDuration}ms)`);
      console.log("[AI PROVIDER] 📥 Response:");
      console.log("  • Content Length:", response.content.length, "characters");
      console.log("  • First 500 chars:", response.content.substring(0, 500));
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(`[AI PROVIDER] ✅ ${provider.toUpperCase()} CALL SUCCESSFUL${isPrimary ? "" : " (FALLBACK USED)"}`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      
      return response;
    } catch (error: any) {
      const attemptDuration = Date.now() - attemptStartTime;
      lastError = error;
      
      const isTimeout = error.message?.includes("TIMEOUT") || error.message?.includes("timeout") || error.message?.includes("exceeded");
      const isConnectionError = error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT" || error.message?.includes("Connection") || error.message?.includes("ECONNREFUSED");
      const isRateLimit = error.message?.includes("rate limit") || error.message?.includes("429") || error.status === 429;
      
      console.error(`[AI PROVIDER] ❌ ${provider.toUpperCase()} failed after ${attemptDuration}ms`);
      console.error("  • Error type:", error?.constructor?.name || typeof error);
      console.error("  • Error message:", error.message || String(error));
      if (error.code) {
        console.error("  • Error code:", error.code);
      }
      if (error.status) {
        console.error("  • HTTP status:", error.status);
      }
      
      // If this is the last provider, throw the error
      if (i === providers.length - 1) {
        console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.error(`[AI PROVIDER] ❌ ALL PROVIDERS FAILED`);
        console.error(`[AI PROVIDER] ⏱️  Total time: ${Date.now() - callStartTime}ms`);
        console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        throw error;
      }
      
      // Try next provider if timeout, connection error, or rate limit
      if (isTimeout || isConnectionError || isRateLimit) {
        const nextProvider = providers[i + 1];
        console.log(`[AI PROVIDER] 🔄 Switching to fallback provider: ${nextProvider.toUpperCase()} (reason: ${isTimeout ? "timeout" : isConnectionError ? "connection error" : "rate limit"})`);
        // Small delay before trying next provider
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        // For other errors, also try fallback
        console.log(`[AI PROVIDER] 🔄 Trying fallback provider: ${providers[i + 1].toUpperCase()}`);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }
  
  // Should never reach here, but TypeScript needs it
  throw lastError || new Error("All providers failed");
}

/**
 * Parse JSON response from AI (handles markdown code blocks)
 */
export function parseAIJSONResponse(content: string): any {
  // Extract JSON object if wrapped in text or markdown
  let cleaned = content.trim();
  
  // Find valid JSON start and end
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  } else {
    // Fallback: cleaning markdown if braces not found (unlikely for valid JSON)
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
    cleaned = cleaned.replace(/^```\s*/i, '').replace(/\s*```$/, '');
  }
  
  try {
    return JSON.parse(cleaned);
  } catch (error) {
    // Try to fix common JSON issues
    const fixed = cleaned
      .replace(/([,\s])"(\w+)":/g, '$1"$2":')
      .replace(/,\s*}/g, '}')
      .replace(/,\s*]/g, ']')
      .trim();
    
    try {
      return JSON.parse(fixed);
    } catch (retryError) {
      console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.error("[AI PROVIDER] ❌ JSON PARSE ERROR");
      console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.error("[AI PROVIDER] Parse error:", error);
      console.error("[AI PROVIDER] Content length:", cleaned.length, "characters");
      console.error("[AI PROVIDER] FULL CLEANED CONTENT:");
      console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.error(cleaned); // Log FULL content, not just first 500 chars
      console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      throw new Error(`Failed to parse AI response as JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

