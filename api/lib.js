export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed. Use GET." });
  }

  const { name } = req.query;

  if (!name || typeof name !== "string") {
    return res.status(400).json({ error: "Query parameter 'name' is required." });
  }

  const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "");
  if (!safeName || safeName.includes("..")) {
    return res.status(400).json({ error: "Invalid library name." });
  }

  const owner = process.env.LIBS_REPO_OWNER || "Teapokk";
  const repo = process.env.LIBS_REPO_NAME || "spslang";
  const branch = process.env.LIBS_REPO_BRANCH || "main";

  const headers = {
    Accept: "application/vnd.github.v3+json",
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  async function fetchGithubLibrary(targetPath) {
    const encodedPath = targetPath
      .split("/")
      .map(encodeURIComponent)
      .join("/");

    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`;
    const response = await fetch(url, { headers });

    if (response.status === 404) {
      return { notFound: true };
    }

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`GitHub API ${response.status}: ${errText}`);
    }

    const data = await response.json();
    return { notFound: false, data };
  }

  async function loadLibraryContents(libraryPath) {
    const result = await fetchGithubLibrary(libraryPath);

    if (result.notFound) {
      return null;
    }

    if (!Array.isArray(result.data)) {
      const fileItem = await hydrateFile(result.data);
      return [fileItem];
    }

    const items = [];

    for (const entry of result.data) {
      if (entry.type === "file") {
        const fileItem = await hydrateFile(entry);
        items.push(fileItem);
      } else if (entry.type === "dir") {
        const subLibraries = await loadLibraryContents(entry.path);
        items.push({
          name: entry.name,
          path: entry.path,
          type: "library",
          entries: subLibraries || [],
        });
      }
    }

    return items;
  }

  async function hydrateFile(entry) {
    let contentBase64 = entry.content ? entry.content.replace(/\n/g, "") : null;

    if (!contentBase64 && entry.download_url) {
      const rawRes = await fetch(entry.download_url, { headers });
      if (rawRes.ok) {
        const arrayBuf = await rawRes.arrayBuffer();
        contentBase64 = Buffer.from(arrayBuf).toString("base64");
      }
    }

    return {
      name: entry.name,
      path: entry.path,
      type: "file",
      size: entry.size,
      sha: entry.sha,
      contentBase64,
    };
  }

  try {
    const libraryPath = `${safeName}`;
    const contents = await loadLibraryContents(libraryPath);

    if (!contents) {
      return res.status(404).json({
        error: `Library '${libraryPath}' not found in ${owner}/${repo}.`,
      });
    }

    return res.status(200).json({
      library: safeName,
      rootPath: libraryPath,
      branch,
      totalEntries: contents.length,
      entries: contents,
    });
  } catch (err) {
    return res.status(500).json({
      error: "Failed to fetch library from Storage.",
      details: err.message,
    });
  }
}
