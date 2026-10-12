export async function onRequestGet({ request, env }) {
  const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (!env.ADMIN_PASSWORD || !env.CLOUDFLARE_API_TOKEN) return json({ error: "Add ADMIN_PASSWORD and CLOUDFLARE_API_TOKEN to Cloudflare Pages environment variables." }, 503);
  if ((request.headers.get("authorization") || "") !== "Bearer " + env.ADMIN_PASSWORD) return json({ error: "Unauthorized." }, 401);
  const commit = new URL(request.url).searchParams.get("commit") || "";
  if (!/^[a-f0-9]{40}$/i.test(commit)) return json({ error: "Invalid commit hash." }, 400);
  const account = "1842f2efcd21bfb5585de93e83411f2b";
  const base = "https://api.cloudflare.com/client/v4/accounts/" + account + "/pages/projects/kaivalya-portfolio/deployments";
  const cfHeaders = { "authorization": "Bearer " + env.CLOUDFLARE_API_TOKEN, "content-type": "application/json" };
  try {
    const response = await fetch(base + "?per_page=20", { headers: cfHeaders });
    const data = await response.json();
    if (!response.ok || !data.success) return json({ error: "Could not read Cloudflare deployment status. Check the token's Pages permissions." }, 502);
    const matches = (data.result || []).filter(d => (d.deployment_trigger?.metadata?.commit_hash || "").toLowerCase() === commit.toLowerCase());
    if (!matches.length) return json({ state: "pending", message: "Waiting for Cloudflare to register the commit." });
    const deployment = matches[0];
    if (deployment.is_skipped && deployment.skip_reason === "path_config") {
      const retry = await fetch(base + "/" + deployment.id + "/retry", { method: "POST", headers: cfHeaders });
      const retryData = await retry.json();
      if (!retry.ok || !retryData.success) return json({ state: "failed", error: "Cloudflare skipped this commit and could not retry it." }, 502);
      return json({ state: "building", message: "Starting the Cloudflare deployment." });
    }
    const state = deployment.latest_stage?.status;
    if (state === "success" && deployment.latest_stage?.name === "deploy") return json({ state: "success", url: deployment.url, deployment: deployment.short_id, message: "Your new site is live." });
    if (state === "failure") return json({ state: "failed", error: "Cloudflare build/deployment failed. Check the deployment logs." });
    if (deployment.is_skipped) return json({ state: "building", message: "Cloudflare is scheduling the deployment." });
    return json({ state: "building", message: "Your site is building and deploying." });
  } catch {
    return json({ error: "Could not contact Cloudflare deployment status." }, 502);
  }
}
