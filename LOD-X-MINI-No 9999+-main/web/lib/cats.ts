import { Home, Settings, Wrench, Search, Smile, Users, Film, Download, Bot, MessageSquareReply, GraduationCap, Sticker, Lock, Megaphone, Palette, type LucideIcon } from "lucide-react";
export const CATS: { key: string; label: string; Icon: LucideIcon; blurb: string }[] = [
  { key: "main", label: "Main", Icon: Home, blurb: "Menu, pair, alive, ping, owner, bots" },
  { key: "download", label: "Download", Icon: Download, blurb: "Songs, videos, TikTok, Facebook, MediaFire, Drive, APK" },
  { key: "ai", label: "AI", Icon: Bot, blurb: "Ask the AI, your own Gemini key, persona, auto-reply" },
  { key: "channel", label: "Channel", Icon: Megaphone, blurb: "Your channels: .csong, follow/unfollow, react, post, info" },
  { key: "aiimage", label: "AI Image", Icon: Palette, blurb: "AI images, remove background, HD upscale, text→video, iPhone quote" },
  { key: "reply", label: "Auto reply", Icon: MessageSquareReply, blurb: "Keyword replies for private chats" },
  { key: "education", label: "Education", Icon: GraduationCap, blurb: "O/L · A/L · scholarship results, dictionary, units, quiz" },
  { key: "sticker", label: "Sticker", Icon: Sticker, blurb: "Image/video → sticker, emoji mix, text stickers" },
  { key: "privacy", label: "Privacy", Icon: Lock, blurb: "Last seen, profile, block list, bio, disappearing mode" },
  { key: "settings", label: "Settings", Icon: Settings, blurb: "Prefix, mode, buttons, theme, online, typing, bot name" },
  { key: "tools", label: "Tools", Icon: Wrench, blurb: "Translate (සිංහල), screenshot, upload, QR, currency, IP" },
  { key: "search", label: "Search", Icon: Search, blurb: "YouTube, lyrics, Wikipedia, weather, GitHub, DP" },
  { key: "fun", label: "Fun", Icon: Smile, blurb: "Jokes, memes, Pokédex, trivia, cats & dogs" },
  { key: "group", label: "Group", Icon: Users, blurb: "Anti-link/spam, welcome, warns, tag all, kick, polls" },
  { key: "media", label: "Media", Icon: Film, blurb: "AI images, view-once reveal, profile pictures" },
];
