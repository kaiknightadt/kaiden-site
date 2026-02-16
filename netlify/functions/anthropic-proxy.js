// netlify/functions/anthropic-proxy.js
// Proxies requests to Anthropic API so the API key stays server-side

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  if (!ANTHROPIC_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "ANTHROPIC_KEY not configured" }) };
  }

  try {
    const data = JSON.parse(event.body);
    const { max_tokens, messages } = data;

    const response = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: max_tokens || 1000,
        messages: messages,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Anthropic API error:", JSON.stringify(result));
      return { statusCode: response.status, headers, body: JSON.stringify(result) };
    }

    return { statusCode: 200, headers, body: JSON.stringify(result) };
  } catch (e) {
    console.error("Proxy error:", e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Proxy error" }) };
  }
};
