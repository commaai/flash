# flash

► [flash.comma.ai](https://flash.comma.ai)

This tool allows you to flash AGNOS onto your comma device. Uses [qdl.js](https://github.com/commaai/qdl.js).

## Development

```bash
bun install
bun dev
```

Open [http://localhost:5173](http://localhost:5173) with your browser to see the result.

You can start editing the page by modifying `src/app.js`. The page auto-updates as you edit the file.

# Performance Comparison: React vs Alpine.js

## Overview

This document compares the performance metrics between a React implementation and an Alpine.js implementation of the same application.

## Lighthouse Performance Metrics

| Metric                             | React      | Alpine.js  | Winner       |
| ---------------------------------- | ---------- | ---------- | ------------ |
| **Overall Performance Score**      | 0.87 (87%) | 1.0 (100%) | 🏆 Alpine.js |
| **First Contentful Paint (FCP)**   | 0.3s       | 0.3s       | 🤝 Tie       |
| **Largest Contentful Paint (LCP)** | 1.3s       | 0.6s       | 🏆 Alpine.js |
| **Speed Index**                    | 4.5s       | 0.3s       | 🏆 Alpine.js |
| **Total Blocking Time (TBT)**      | 0ms        | 0ms        | 🤝 Tie       |
| **Cumulative Layout Shift (CLS)**  | 0          | 0.004      | 🏆 React     |

## Build Size Metrics

| Metric                | React     | Alpine.js | Winner       |
| --------------------- | --------- | --------- | ------------ |
| **Uncompressed Size** | 153.37 kB | 98.58 kB  | 🏆 Alpine.js |
| **Gzipped Size**      | 50.00 kB  | 34.44 kB  | 🏆 Alpine.js |

## Summary

### Alpine.js Advantages:

- **Superior overall performance** (100% vs 87%)
- **Faster Largest Contentful Paint** (0.6s vs 1.3s)
- **Significantly better Speed Index** (0.3s vs 4.5s)
- **Dramatically smaller uncompressed bundle size** (98.58 kB vs 153.37 kB)
- **Substantially smaller gzipped size** (34.44 kB vs 50.00 kB)

### React Advantages:

- **Slightly better Cumulative Layout Shift** (0 vs 0.004)

### Key Findings:

- Alpine.js shows **dramatically better Speed Index performance** (15x faster)
- Alpine.js achieves **perfect 100% Lighthouse performance score**
- Both frameworks perform equally well for **First Contentful Paint** and **Total Blocking Time**
- **Alpine.js has significantly smaller bundle sizes** (36% smaller uncompressed, 31% smaller gzipped)
- Alpine.js provides **better perceived performance**

### Additional Considerations:

As this application scales, TypeScript & Astro could be considered for enhanced development experience and maintainability:

**Astro Integration:**

- Could provide continued performance through static site generation and selective hydration
- Enables component island architecture for mixing reactivity only where needed
- Potential for sub-second load times through aggressive optimization

**TypeScript Adoption:**

- Enhanced developer experience with better IDE support and autocomplete
- Type safety to prevent runtime errors as codebase complexity increases
- Better refactoring capabilities and code documentation

**Current Design Decisions:**
For this version, these technologies were intentionally omitted to prioritize:

- **Simplicity** - Minimal learning curve and setup complexity
- **Brevity** - Lean codebase with fewer abstractions
- **Performance** - Direct JavaScript execution without compilation overhead
- **Development Speed** - Rapid prototyping and iteration
