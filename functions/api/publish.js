export async function onRequestPost({ request, env }) {
  const cors = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });
  if (!env.ADMIN_PASSWORD || !env.GITHUB_TOKEN || !env.CLOUDFLARE_API_TOKEN) {
    return json({ error: "Editor setup is incomplete. Add ADMIN_PASSWORD, GITHUB_TOKEN, and CLOUDFLARE_API_TOKEN to Cloudflare Pages environment variables, then retry." }, 503);
  }
  const auth = request.headers.get("authorization") || "";
  if (auth !== "Bearer " + env.ADMIN_PASSWORD) return json({ error: "Wrong editor password." }, 401);
  let payload;
  try { payload = await request.json(); } catch { return json({ error: "Invalid JSON request." }, 400); }
  if (typeof payload.html !== "string" || payload.html.length < 100 || payload.html.length > 500000) {
    return json({ error: "The HTML is missing or exceeds the 500 KB editor limit." }, 413);
  }
  const owner = "kaivalyajoshi20", repo = "my-portfoilo", path = "index.html", branch = "main";
  const api = "https://api.github.com/repos/" + owner + "/" + repo + "/contents/" + path;
  const headers = { "authorization": "Bearer " + env.GITHUB_TOKEN, "accept": "application/vnd.github+json", "content-type": "application/json", "x-github-api-version": "2022-11-28", "user-agent": "Portfolio-Studio" };
  try {
    const current = await fetch(api + "?ref=" + branch, { headers });
    if (!current.ok) return json({ error: "Could not read index.html from GitHub (" + current.status + "). Check GITHUB_TOKEN permissions." }, 502);
    const file = await current.json();
    const encoded = btoa(unescape(encodeURIComponent(payload.html)));
    const update = await fetch(api, { method: "PUT", headers, body: JSON.stringify({ message: "Publish portfolio changes from Portfolio Studio", content: encoded, sha: file.sha, branch }) });
    const result = await update.json();
    if (!update.ok) return json({ error: result.message || "GitHub rejected the commit (" + update.status + ")." }, 502);
    return json({ ok: true, commit: result.commit?.sha || null, message: "GitHub commit created. Cloudflare Pages should deploy it automatically." });
  } catch (error) {
    return json({ error: "Publishing request failed. Please retry after checking your connection." }, 502);
  }
}
