---
title: Field Visualizer
summary: Electric Field Visualizer
date: 2025-11-6
tags: [C++, SFML, Cmake]
# Solid page colour; leave it out to use site.projectColor, or set `background:` to a photo
bgColor: "#6e4d00"
thumbnail: /thumbnails/field-visualizer.png
accent: "#e5dd42"   # parchment gold: links, header strip, card hover glow
gallery:
  - src: /field-visualizer/visualizer-recording.mp4
    caption: Dynamically updating electric field.
links:
  - label: GitHub
    href: https://github.com/jjcarsello/field-visualizer.git
order: 4
draft: false
---

## Overview

When I was taking Physics 212, Electricity and Magnetism, I liked the idea of making something that could visualize the nature of charged particles interacting, mostly because I thought it would be cool.

## The approach

Users are able to put down stationary or mobile charged particles of either a positive or negative charge, and their positions are updated based on force calculations that are superposed over one another.

## Results

I used the SFML library for graphics, since it was a pretty lightweight easy to use C++ library and I wanted to learn how to code in C++. This was also the first time I used Cmake for build streamlining which was a challenge to learn. In all this was a pretty foundational coding project for me to learn about a lower level language since most of my prior experience was in Java and Python.