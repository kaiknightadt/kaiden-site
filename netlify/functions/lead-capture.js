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
      const notionRes = await fetch(NOTION_API, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${NOTION_KEY}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          parent: { database_id: NOTION_DB },
          properties: {
            // "Prénom" is the Title column
            "Prénom": {
              title: [{ text: { content: prenom || "Anonyme" } }],
            },
            // "E-mail" is an Email column
            "E-mail": {
              email: email,
            },
            // "Ressource" is a Status/Select column
            "Ressource": {
              status: { name: source || "Blog" },
            },
            // "Date" is a Date column
            "Date": {
              date: { start: new Date().toISOString().split("T")[0] },
            },
          },
        }),
      });

      if (notionRes.ok) {
        results.notion = "ok";
      } else {
        const err = await notionRes.text();
        console.error("Notion error:", err);
        
        // Fallback: try with select instead of status for "Ressource"
        const notionRetry = await fetch(NOTION_API, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${NOTION_KEY}`,
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            parent: { database_id: NOTION_DB },
            properties: {
              "Prénom": {
                title: [{ text: { content: prenom || "Anonyme" } }],
              },
              "E-mail": {
                email: email,
              },
              "Ressource": {
                select: { name: source || "Blog" },
              },
              "Date": {
                date: { start: new Date().toISOString().split("T")[0] },
              },
            },
          }),
        });
        
        if (notionRetry.ok) {
          results.notion = "ok";
        } else {
          const retryErr = await notionRetry.text();
          console.error("Notion retry error:", retryErr);
          results.notion = "error";
        }
      }
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
            PRENOM: prenom || "",
            SOURCE: source || "Blog",
          },
          listIds: [2], // Default list ID — update after creating your list in Brevo
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
