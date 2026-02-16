// netlify/functions/lead-capture.js
// Receives form data from blog gates, diagnostic, and waitlist
// Sends to Notion database + Brevo contact list

const NOTION_API = "https://api.notion.com/v1/pages";
const NOTION_KEY = process.env.NOTION_KEY;
const NOTION_DB = process.env.NOTION_DB;

const BREVO_API = "https://api.brevo.com/v3/contacts";
const BREVO_KEY = process.env.BREVO_KEY;

exports.handler = async (event) => {
  // CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  // Handle preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const data = JSON.parse(event.body);
    const { prenom, email, source } = data;

    if (!email || !email.includes("@")) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Email invalide" }) };
    }

    const results = { notion: null, brevo: null };

    // ===== 1. NOTION — Create database entry =====
    try {
      const notionHeaders = {
        "Authorization": `Bearer ${NOTION_KEY}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      };
      const baseProps = {
        "Prénom": { title: [{ text: { content: prenom || "Anonyme" } }] },
        "E-mail": { email: email },
        "Date": { date: { start: new Date().toISOString().split("T")[0] } },
      };

      // Try select first (most common), fallback to status
      const ressourceTypes = [
        { select: { name: source || "Blog" } },
        { status: { name: source || "Blog" } },
      ];

      let notionOk = false;
      for (const ressourceValue of ressourceTypes) {
        const notionRes = await fetch(NOTION_API, {
          method: "POST",
          headers: notionHeaders,
          body: JSON.stringify({
            parent: { database_id: NOTION_DB },
            properties: { ...baseProps, "Ressource": ressourceValue },
          }),
        });
        if (notionRes.ok) {
          notionOk = true;
          break;
        }
        const err = await notionRes.text();
        console.error("Notion attempt error:", err);
      }
      results.notion = notionOk ? "ok" : "error";
    } catch (e) {
      console.error("Notion exception:", e);
      results.notion = "error";
    }

    // ===== 2. BREVO — Add/update contact =====
    try {
      const brevoRes = await fetch(BREVO_API, {
        method: "POST",
        headers: {
          "api-key": BREVO_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email,
          attributes: {
            FIRSTNAME: prenom || "",
            SOURCE: source || "Blog",
          },
          listIds: [5], // Kpibara list
          updateEnabled: true, // Update if contact already exists
        }),
      });

      if (brevoRes.ok || brevoRes.status === 201 || brevoRes.status === 204) {
        results.brevo = "ok";
      } else {
        const err = await brevoRes.text();
        console.error("Brevo error:", err);
        // Contact might already exist — that's fine
        if (err.includes("already exist")) {
          results.brevo = "ok (existing)";
        } else {
          results.brevo = "error";
        }
      }
    } catch (e) {
      console.error("Brevo exception:", e);
      results.brevo = "error";
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: "Lead captured",
        results,
      }),
    };

  } catch (e) {
    console.error("Global error:", e);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Erreur serveur" }),
    };
  }
};
