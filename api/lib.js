export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return res.status(405).json({ error: "Method not allowed. Use GET." });
  }

  const { name } = req.query;
  if (!name || typeof name !== "string") {
    return res.status(400).json({ error: "Query parameter 'name' is required." });
  }

  const safeName = name.trim();
  if (!safeName || safeName.includes("..") || /[\r\n]/.test(safeName)) {
    return res.status(400).json({ error: "Invalid library name." });
  }

  const libsTxtUrl =
    process.env.LIBS_TXT_URL ||
    "https://raw.githubusercontent.com/Teapokk/spslang/refs/heads/main/libs.txt";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const txtRes = await fetch(libsTxtUrl, {
      headers: { "User-Agent": "SPS-Registry", "Cache-Control": "no-cache" },
      signal: controller.signal,
    });

    if (!txtRes.ok) {
      return res.status(502).json({
        error: `Failed to load libs.txt (HTTP ${txtRes.status}).`,
      });
    }

    const rawTxt = await txtRes.text();
    let targetUrl = null;

    for (const rawLine of rawTxt.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;

      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) continue;

      const libKey = line.slice(0, colonIdx).trim();
      const libUrl = line.slice(colonIdx + 1).trim();

      if (libKey === safeName && libUrl) {
        targetUrl = libUrl;
        break;
      }
    }

    if (!targetUrl) {
      return res.status(404).json({
        error: `Library '${safeName}' not found in libs.txt.`,
      });
    }

    const assetRes = await fetch(targetUrl, {
      headers: { "User-Agent": "SPS-Registry" },
      redirect: "follow",
      signal: controller.signal,
    });

    if (!assetRes.ok) {
      const statusCode = assetRes.status === 404 ? 404 : 502;
      return res.status(statusCode).json({
        error: `Failed to fetch library file (HTTP ${assetRes.status}).`,
      });
    }

    const arrayBuf = await assetRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    const content = buffer.toString("utf8");
    const contentBase64 = buffer.toString("base64");

    const urlPath = new URL(targetUrl).pathname;
    const rawFileName = urlPath.split("/").pop() || `${safeName}.sl`;
    const fileName = decodeURIComponent(rawFileName);
    const libFolder = safeName.endsWith(".sol") ? safeName : `${safeName}.sol`;

    return res.status(200).json({
      library: safeName,
      entries: [
        {
          name: fileName,
          path: `${libFolder}/${fileName}`,
          type: "file",
          size: buffer.length,
          content,
          contentBase64,
        },
      ],
    });
  } catch (err) {
    return res.status(500).json({
      error: "Registry error while resolving library.",
      details: err && err.message ? err.message : String(err),
    });
  } finally {
    clearTimeout(timer);
  }
}
