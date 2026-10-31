---
title: STM32 Ethernet Implementation with FreeRTOS
summary: Utilized FreeRTOS and a Posix LWIP C Library to support Ethernet communication with an STM32
date: 2026-9-15
tags: [STM32 CubeMX, C, CLion, openOCD, LWIP]
# Solid page colour; leave it out to use site.projectColor, or set `background:` to a photo
bgColor: "#2b3342"
thumbnail: /thumbnails/lwip-stm32.png
accent: "#b0b9ff"   # parchment gold: links, header strip, card hover glow
links:
  - label: GitHub
    href: https://github.com/jjcarsello/freeRTOS_TCP_practice.git
order: 3
draft: false
---

## Overview

As a member of Liquid Rocketry at Illinois I was tasked with helping to transition our telemetry systems from USB communication to Ethernet due to the greater distance it could support, so I did this test project to get used to the Posix protocol first.

## The approach

I used the STM32 CubeMx interface to add the necessary middleware including FreeRTOS, as well as setting up the pin activation. One challenge was in the memory placement of the DMA buffers, as the LWIP memory pool in STM32 is not automatically defined to be at x3000000 (which is where the SRAM locations begin). So the user has to define those and write the necessary linker scripts.

## Results

Ultimately we were able to get it to echo back responses sent to it via ethernet.
