
import "dotenv/config";
import { callAIProvider } from "./ai-providers";

async function test() {
  try {
    console.log("Testing Perplexity integration...");
    
    // Check if key is available
    if (!process.env.PERPLEXITY_API_KEY) {
      console.error("❌ PERPLEXITY_API_KEY is missing in environment variables.");
      process.exit(1);
    }

    const response = await callAIProvider({
      systemPrompt: "You are a helpful assistant.",
      userPrompt: "Hello, confirm you are running on a Perplexity/Sonar model.",
      model: "sonar"
    }, false); // Disable fallback to ensure we test Perplexity
    
    console.log("✅ Response received:");
    console.log(response.content);
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

test();
