# Phase 8 — Production Hardening and Vercel Deployment

## Objective

Prepare WeatherBoard for production deployment,
validate the existing Vercel deployment,
and improve production reliability.

## Instructions for Claude Code

### Deployment configuration

Audit the existing Vercel deployment before changing configuration.

Verify:

- Production build
- Build output directory
- Node.js version requirements
- SPA routing behavior
- Static asset delivery
- Manifest delivery
- Service worker delivery
- PWA icon delivery

Do not introduce unnecessary deployment configuration.

### Security headers

Configure appropriate headers, including:

- X-Content-Type-Options
- Referrer-Policy
- X-Frame-Options
- Permissions-Policy

Configure suitable cache policies.

### Caching

Requirements:

- Fingerprinted static assets may use long-lived immutable caching.
- Application shell must revalidate appropriately.
- Service worker must revalidate.
- Manifest must revalidate.
- Do not cache weather API responses in the service worker.

### Production reliability

- Review production dependencies.
- Check for security vulnerabilities.
- Avoid unnecessary dependencies.
- Review bundle size.
- Keep optional features lazy-loaded.
- Handle API failures gracefully.

### Analytics

Evaluate Vercel Analytics.

Requirements:

- Analytics must be optional.
- Disabled by default.
- Do not enable analytics in preview deployments.
- Avoid collecting unnecessary personal information.
- Document configuration.

### Deployment smoke test

Create a read-only deployment validation script.

Check:

- HTTPS availability
- Index response
- HTML content type
- Cache headers
- Security headers
- JavaScript asset availability
- JavaScript MIME types
- Service worker availability
- Manifest validity
- PWA icon availability
- Unknown route behavior

The script must not modify the deployed application.

### PWA manual validation

Document manual checks for:

1. Installing WeatherBoard from a supported browser.
2. Launching the installed application.
3. Verifying standalone display mode.
4. Loading the application online.
5. Disconnecting the network.
6. Reloading while offline.
7. Verifying cached application shell and weather data.
8. Reconnecting and verifying refresh behavior.

Automated deployment smoke tests must not be described as
proof of successful real-device installation or offline behavior.

### Analytics validation

Document that actual Analytics data must be checked
in the Vercel dashboard.

### Documentation

Update:

- README.md
- Deployment instructions
- Environment variable documentation
- Production validation instructions
- Known limitations

### Testing

Run:

- TypeScript checks
- ESLint
- Unit tests
- End-to-end tests
- Production build
- Deployment smoke test

### Git workflow

Create branch: feature/production-deployment

Use Conventional Commits.

Do not push directly to main.
Do not merge automatically.
Require explicit approval before merging.

### Final report

Provide:

1. Changes made.
2. Tests executed.
3. Test results.
4. Production deployment status.
5. Security review results.
6. Known limitations.
7. Required manual verification.
8. Git commit hashes.
