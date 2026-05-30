---
description: Prime agent with codebase understanding
---

# Prime: Load Project Context

## Objective

Build comprehensive understanding of the codebase by analyzing structure, documentation, and key files.

## Process

### 1. Analyze Project Structure

List all tracked files:
!`git ls-files`

Show directory structure:
!`find . -maxdepth 3 -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/.next/*' -not -path '*/dist/*' | sort`

### 2. Read Core Documentation

- Read `docs/prd.md` (source of truth for product requirements — MVP)
- Read `CLAUDE.md` (global rules and conventions) and `AGENTS.md`
- Read `README.md` at project root
- Read `prisma/schema.prisma` (database schema)
- Read `docs/context.md` (glosario de lenguaje ubicuo del dominio)
- List features in `docs/PRPs/` (cada una con `<feature>-prp.md` + `<feature>-roadmap.md`) and the product index in `docs/roadmap/`

### 3. Identify Key Files

Based on the structure, identify and read:
- Main entry points (`src/app/layout.tsx`)
- Core configuration (`package.json`, `tsconfig.json`, `next.config.ts`, `components.json`)
- Database schema (`prisma/schema.prisma`)
- Auth configuration (`src/lib/auth.ts`, `src/proxy.ts`)
- Service files (`src/services/*.ts`)
- Validation schemas (`src/lib/validations/*.ts`)
- Email templates (`src/components/emails/*.tsx`)

### 4. Understand Current State

Check recent activity:
!`git log -10 --oneline`

Check current branch and status:
!`git status`

## Output Report

Provide a concise summary covering:

### Project Overview
- Purpose and type of application
- Primary technologies and frameworks
- Current version/state

### Architecture
- Overall structure and organization
- Key architectural patterns (actions → services → Prisma)
- Important directories and their purposes

### Tech Stack
- Next.js 16 (App Router) + React 19
- Prisma 6 + PostgreSQL (Neon)
- NextAuth v5 (OTP email)
- Resend + React Email
- Vercel Blob (storage)
- Tailwind CSS 4 + shadcn/ui
- pnpm

### Database Schema
- Tables, relationships, and indexes
- Role system (SUPERADMIN, ADMIN, PLAYER)
- Tournament → Category → Player → Match flow

### Core Principles
- Code style and conventions
- Component patterns (RSC vs client)
- Timezone handling (UTC in DB, UY in UI)

### Current State
- Active branch
- Recent changes or development focus
- Any immediate observations

**Make this summary easy to scan - use bullet points and clear headers.**
