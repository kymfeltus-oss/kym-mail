/** AI executes bounded contracts; it never owns workflow or authoritative state. */
export interface AIProvider { readonly id: string; healthCheck(): Promise<{ available: boolean }>; }
