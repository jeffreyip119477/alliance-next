Alliance Combinations Calculator is an offline-friendly Next.js tool for
evaluating contract awards across tenderers. Each selected contract must be
covered by a bid, and every awarded amount must be no greater than that
contract's original lowest submitted base price. Pins, blocks, and maximum-win
constraints can therefore make a scenario infeasible rather than authorizing a
higher price.

The calculator supports manual and random input, contract selection, tenderer
constraints, calculation history, what-if analysis, showcase data, dark mode,
and PDF reporting. Calculator-specific code lives under
`src/features/alliance-calculator`; shared UI primitives remain under
`src/components/ui`.

For large grids (up to 10 contracts × 20 tenderers), the calculator uses an
exact subset dynamic-programming solver to find the best compliant award. It
does not materialize every assignment in that case; the result explains when
the strategy explorer has been capped. Average-DoP mode is disabled for new
manual calculations.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

The application entrypoint is `src/app/page.tsx`; the calculator implementation
is composed from the feature modules under `src/features/alliance-calculator`.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Docker

### Build the image

```bash
docker buildx build --platform linux/arm64,linux/amd64 \
  -t username/repository-name:tag --push .
```

### Run with Docker

```bash
docker run -p 3000:3000 -e NODE_ENV=production alliance-next
```

### Or use Docker Compose

```bash
docker compose up --build
```

The application will be available at `http://localhost:3000`.
