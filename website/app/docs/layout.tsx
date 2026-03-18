import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { source } from "@/lib/source";
import type { ReactNode } from "react";

const footerLinks = [
  { text: "GitHub", url: "https://github.com/MacPaw/eney-skills" },
  { text: "Eney", url: "https://eney.ai" },
  { text: "Discord", url: "https://discord.gg/macpaw" },
  { text: "MacPaw", url: "https://macpaw.com" },
];

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout nav={{ title: "Eney" }} tree={source.getPageTree()}>
      {children}
      <footer className="border-t py-6 px-4 mt-auto">
        <div className="flex flex-wrap gap-4 justify-center text-sm text-fd-muted-foreground">
          {footerLinks.map((link) => (
            <a
              key={link.text}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-fd-foreground transition-colors"
            >
              {link.text}
            </a>
          ))}
        </div>
      </footer>
    </DocsLayout>
  );
}
