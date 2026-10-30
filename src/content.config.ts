import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const projects = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    date: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    // Paths under public/, e.g. "/backgrounds/robot-lab.jpg"
    thumbnail: z.string().optional(),
    background: z.string().optional(),
    // Solid page colour, e.g. "#0f172b"; used when there's no background photo
    bgColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, 'use a 6-digit hex colour like "#0f172b"')
      .optional(),
    // How blurred the background is, 0 (sharp) to ~6 (very soft); projects default to 4.5
    blur: z.number().min(0).max(6).default(4.5),
    // Tints the card glow and page accents
    accent: z.string().default('#ff5f05'),
    links: z
      .array(z.object({ label: z.string(), href: z.string() }))
      .default([]),
    // Lower numbers show first; ties fall back to newest date
    order: z.number().default(100),
    draft: z.boolean().default(false),
  }),
});

export const collections = { projects };
