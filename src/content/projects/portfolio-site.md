---
title: This Portfolio
summary: A glassmorphism portfolio built with Astro, content collections, and view transitions.
date: 2026-10-29
tags: [web, astro, css]
accent: "#ff5f05"
bgColor: "#0f172b"   # the Astro logo's navy
thumbnail: /thumbnails/astro_photo.webp
links:
  - label: Source
    href: https://github.com/jjcarsello/jjcarsello.github.io
order: 1
---

## Overview

Every project on this site is a single Markdown file. The homepage reads them all and
builds a card for each, and each one gets its own page, like this one.

## How it works

- **Astro content collections** validate each project's frontmatter.
- A two-pass WebGL shader renders liquid glass behind each panel
- **View transitions** morph a card into its page when you click it.

## What I learned

The biggest challenge in this site was definitely trying to not do too much. I wanted to have this rotation gimmick where it would blur the background as you scrolled but it made the site too distracting and at some point function must come over form. 