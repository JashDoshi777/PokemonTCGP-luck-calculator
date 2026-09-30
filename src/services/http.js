const DEFAULT_TIMEOUT_MS = 12000;

// GET a JSON document with a timeout. With `retries`, network errors, timeouts and
// 5xx answers are retried after a short pause (public CDNs occasionally blip);
// 4xx answers are final.
export async function fetchJson(url, { timeoutMs = DEFAULT_TIMEOUT_MS, retries = 0 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (res.ok) return await res.json();

      const error = new Error(`Request failed (${res.status}): ${url}`);
      if (res.status < 500) {
        error.final = true;
        throw error;
      }
      lastError = error;
    } catch (error) {
      if (error.final) throw error;
      lastError = error;
    } finally {
      clearTimeout(timer);
    }
    if (attempt < retries) await new Promise(resolve => setTimeout(resolve, 600 * (attempt + 1)));
  }
  throw lastError;
}
