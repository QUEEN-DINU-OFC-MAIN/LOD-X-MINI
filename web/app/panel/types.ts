export type Field = { key: string; label: string; desc: string; group: string; type: "bool" | "select" | "text" | "textarea"; options?: [string, string][]; max?: number; soon?: boolean };
export type Sched = { id: string; to: string; type: "text" | "image" | "video" | "voice"; text: string; at: number; size: number };
export type Me = {
  number: string; pn?: string; state: string; values: Record<string, string | boolean>; schema: Field[]; language: string; detectedLanguage: string;
  schedules: Sched[]; replies: Record<string, string>; access: Record<string, "owner" | "public">; statusVoice: { at: number; size: number } | null;
  limits: { schedules: number; replies: number; uploadMb: number };
};
export type Api = {
  call: (path: string, init?: { method?: string; body?: unknown }) => Promise<Me>;
  upload: (kind: string, file: Blob, onProgress: (p: number) => void) => Promise<{ mediaKey: string; size: number }>;
  setMe: (m: Me) => void;
  say: (ok: boolean, msg: string) => void;
};
