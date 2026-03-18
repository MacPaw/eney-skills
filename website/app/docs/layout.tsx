import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { source } from "@/lib/source";
import type { ReactNode } from "react";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      nav={{ title: "Eney" }}
      tree={source.getPageTree()}
      links={[
        {
          text: "GitHub",
          url: "https://github.com/MacPaw/eney-skills",
          external: true,
        },
        {
          text: "Eney",
          url: "https://eney.ai",
          external: true,
        },
        {
          text: "Discord",
          url: "https://discord.gg/macpaw",
          external: true,
        },
        {
          text: "MacPaw",
          url: "https://macpaw.com",
          external: true,
        },
      ]}
    >
      {children}
    </DocsLayout>
  );
}
