import axios from "axios";
import { api } from "./api";
import { getToken } from "../lib/authStorage";

export async function downloadFile(url, { filename, params } = {}) {
  const raw = String(url || "");
  const isAbsolute = raw.startsWith("http://") || raw.startsWith("https://");

  const token = getToken();
  const response = isAbsolute
    ? await axios.get(raw, {
        responseType: "blob",
        params,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
    : await api.get(raw, {
        responseType: "blob",
        params,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

  const blob = isAbsolute ? response.data : response;
  const resolvedFilename = filename || "download";

  const objectUrl = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = resolvedFilename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(objectUrl);
  document.body.removeChild(a);

  return { success: true, filename: resolvedFilename };
}
