# PhotoReady

A browser-based photo preparation web app built with Next.js. Image processing runs in the browser. Razorpay checkout is handled by server routes, and the server verifies payment before enabling a download.

## Run locally

Requirements: Node.js 20.9+ and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. Local checkout can use Razorpay Test Mode credentials. Keep `.env.local` out of Git; it is ignored. Do not commit live keys or set the Razorpay secret as a `NEXT_PUBLIC_*` variable.

## Deploy to Netlify

1. Import this public GitHub repository into Netlify and use the detected Next.js build settings.
2. Add `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `RAZORPAY_KEY_ID`, and `RAZORPAY_KEY_SECRET` in the Netlify site's environment variables. Start with Razorpay Test Mode credentials.
3. Set `NEXT_PUBLIC_SITE_URL` to the deployed site's HTTPS URL and redeploy.
4. Run a full test checkout. Use Live Mode credentials only after Razorpay activates the account for live payments.
5. Replace the placeholder support contact on the privacy page and review the published terms before accepting payments.

The Netlify Free plan currently includes a monthly usage allowance; projects can pause if the allowance is exhausted. Check the current [Netlify pricing and limits](https://www.netlify.com/pricing/) before launch.

## Privacy and payment notes

The app does not upload or store the selected photo. Razorpay handles payment details; the app receives checkout identifiers and verifies the signature and captured payment status through server-side API routes. A page refresh clears the prepared photo, so the user should download it after checkout.

Payment processing requires valid Razorpay credentials. Never commit secrets, payment exports, customer data, or local environment files. See `.env.example` for variable names and safe placeholders.

