// Netlify Function: publish.js
// Receives updated HTML from the frontend and commits it to GitHub,
// triggering an automatic Netlify redeploy.

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body);
    const { action, html, password } = body;

    // All actions require a valid password.
    if (password !== process.env.ADMIN_PASSWORD) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    // Verify-only action: just confirm the password is valid (used by the
    // unlock flow on the client). No GitHub commit.
    if (action === 'verify') {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true })
      };
    }

    // Otherwise this is a publish — html is required.
    if (!html) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing html' }) };
    }

    const token = process.env.GITHUB_TOKEN;
    const repo = 'td718889/kilby26';
    const path = 'index.html';
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'kilby26-publish'
    };

    // Get current file SHA (required by GitHub API to update a file)
    const getRes = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, { headers });
    if (!getRes.ok) {
      const err = await getRes.text();
      return { statusCode: 500, body: JSON.stringify({ error: `Failed to fetch file: ${err}` }) };
    }
    const { sha } = await getRes.json();

    // Commit updated HTML
    const content = Buffer.from(html, 'utf-8').toString('base64');
    const putRes = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message: "KBP26: Update Taylor's notes",
        content,
        sha
      })
    });

    if (!putRes.ok) {
      const err = await putRes.text();
      return { statusCode: 500, body: JSON.stringify({ error: `GitHub commit failed: ${err}` }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
