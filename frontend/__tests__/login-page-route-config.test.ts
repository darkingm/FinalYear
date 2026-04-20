import { describe, expect, it } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';

describe('login route config', () => {
  const loginPagePath = path.join(process.cwd(), 'app', '(auth)', 'login', 'page.tsx');
  const loginClientPath = path.join(process.cwd(), 'app', '(auth)', 'login', 'login-client.tsx');

  it('keeps the route entry as a server file so dynamic config is not ignored', () => {
    const pageSource = fs.readFileSync(loginPagePath, 'utf8');

    expect(pageSource).toContain("export const dynamic = 'force-dynamic'");
    expect(pageSource).not.toMatch(/['"]use client['"]/);
  });

  it('moves the interactive login UI into a dedicated client component', () => {
    expect(fs.existsSync(loginClientPath)).toBe(true);

    const clientSource = fs.readFileSync(loginClientPath, 'utf8');
    expect(clientSource).toMatch(/['"]use client['"]/);
  });
});
