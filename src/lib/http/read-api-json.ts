export async function readApiJson<T extends { error?: string }>(response: Response): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    if (response.status === 413 || /^Request Entit/i.test(text)) {
      return { error: "The message or attachments are too large to send this way." } as T;
    }
    if (response.status === 401) {
      return { error: "Reconnect Google Mail to continue." } as T;
    }
    return { error: "The request could not be completed. Try again." } as T;
  }
}
