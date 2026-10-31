---
title: Historical Atlas
summary: An interactive historical map
date: 2026-10-31
tags: [Angular, Typescript, jsdelivr, Node]
# Solid page colour; leave it out to use site.projectColor, or set `background:` to a photo
bgColor: "#765a32"
thumbnail: /thumbnails/historical-atlas.png
gallery:
  - src: /thumbnails/historical-atlas.png
    caption: Globe View
  - src: /historical-atlas/flat-atlas.png
    caption: Flat View
  - src: /historical-atlas/wiki-atlas.png
    caption: Wiki Data
accent: "#f0c674"   # parchment gold: links, header strip, card hover glow
links:
  - label: GitHub
    href: https://github.com/jjcarsello/historical-atlas.git
order: 2
draft: false
---

## Overview

I am a big fan of history and especially games like Europa Universalis IV, so I wanted to try to make an interactive map similar to the ones that they offer in those games.

## The approach

I found an open source github link of  [historical basemaps](https://github.com/aourednik/historical-basemaps) to pull GeoJSON data from using JsDelivr, and then used the MapLibre library to display it. It also pulls from wikipedia on click of each nation to instantly poll data about the nation to the user.

## Results

The biggest challenge was figuring out how the naming conventions work, particularly when name tags overlap each other. However by factoring in the individual components of each GeoJSON piece I could compare nations including their subject territories to favor nations of greater size, dependent on the zoom of the user. 
