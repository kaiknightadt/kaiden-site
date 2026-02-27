const BREVO_KEY = process.env.BREVO_KEY;

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  if (!BREVO_KEY) {
    console.error('BREVO_KEY environment variable is not set');
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server configuration error' }) };
  }

  let data;
  try {
    data = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { name, email, linkedin, q1, q2, q3, q4, q5 } = data;

  // ── 1. Ajouter le contact dans Brevo ──────────────────────────────
  try {
    const res = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: { 'accept': 'application/json', 'content-type': 'application/json', 'api-key': BREVO_KEY },
      body: JSON.stringify({
        email,
        updateEnabled: true,
        listIds: [10],
        attributes: {
          PRENOM: name,
          LINKEDIN: linkedin || '',
          POURQUOI_MOI: q5,
          REPONSES_QUIZ: `Q1:\n${q1}\n\nQ2:\n${q2}\n\nQ3:\n${q3}\n\nQ4:\n${q4}\n\nQ5:\n${q5}`
        }
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (err.code !== 'duplicate_parameter') {
        console.error('Brevo contact error:', JSON.stringify(err));
        return { statusCode: 502, headers, body: JSON.stringify({ error: 'Brevo contact failed', detail: err.message || err.code }) };
      }
    }
  } catch (e) {
    console.error('Brevo contact fetch failed:', e);
    return { statusCode: 502, headers, body: JSON.stringify({ error: 'Brevo contact request failed' }) };
  }

  // ── 2. Envoyer la notif email à Kaiden ────────────────────────────
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'accept': 'application/json', 'content-type': 'application/json', 'api-key': BREVO_KEY },
      body: JSON.stringify({
        sender: { name: 'KPIbara Recrutement', email: 'kaidenvialle@gmail.com' },
        to: [{ email: 'kaidenvialle@gmail.com', name: 'Kaiden' }],
        subject: `🐾 Nouveau dossier — ${name}`,
        htmlContent: `
<div style="font-family:monospace;background:#070709;color:#e2e2f0;padding:32px;max-width:620px">
  <div style="color:#ec4899;font-size:22px;font-weight:bold;margin-bottom:24px">🐾 Nouveau dossier de candidature</div>

  <div style="background:#0d0d12;border-left:3px solid #ec4899;padding:20px;margin-bottom:16px">
    <div style="color:#ec4899;font-size:10px;letter-spacing:2px;margin-bottom:10px">IDENTITÉ</div>
    <b>${name}</b><br>
    <span style="color:#9999bb">${email}</span>
    ${linkedin ? `<br><span style="color:#9999bb">${linkedin}</span>` : ''}
  </div>

  <div style="background:#0d0d12;border-left:3px solid #ec4899;padding:20px;">
    <div style="color:#ec4899;font-size:10px;letter-spacing:2px;margin-bottom:14px">RÉPONSES</div>
    <p style="color:#ec4899;font-size:11px;margin-bottom:4px">01 — Convaincre quelqu'un de difficile</p>
    <p style="color:#b8b8d0;margin-bottom:16px;white-space:pre-wrap">${q1}</p>
    <p style="color:#ec4899;font-size:11px;margin-bottom:4px">02 — "C'est trop cher" — ta réponse</p>
    <p style="color:#b8b8d0;margin-bottom:16px;white-space:pre-wrap">${q2}</p>
    <p style="color:#ec4899;font-size:11px;margin-bottom:4px">03 — Organisation prospection</p>
    <p style="color:#b8b8d0;margin-bottom:16px;white-space:pre-wrap">${q3}</p>
    <p style="color:#ec4899;font-size:11px;margin-bottom:4px">04 — Force & point faible</p>
    <p style="color:#b8b8d0;margin-bottom:16px;white-space:pre-wrap">${q4}</p>
    <p style="color:#ec4899;font-size:11px;margin-bottom:4px">05 — Pourquoi KPIbara</p>
    <p style="color:#b8b8d0;white-space:pre-wrap">${q5}</p>
  </div>

  <div style="margin-top:20px;font-size:11px;color:#6b6b8a">Envoyé depuis kpibara.netlify.app/associe</div>
</div>`
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('Brevo email error:', JSON.stringify(err));
    }
  } catch (e) {
    console.error('Brevo email fetch failed:', e);
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ success: true })
  };
};
