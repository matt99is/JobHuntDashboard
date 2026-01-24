# Google OAuth Verification - Domain Ownership

## Issues Fixed ✅

1. **Privacy Policy Link** - Added footer with links to Privacy Policy and Terms of Use
2. **App Name Mismatch** - Updated app name to "Job Hunt Assistant" (matches OAuth consent screen)
3. **Domain Verification** - Follow steps below

## Domain Verification Instructions

### Method 1: HTML Meta Tag (Recommended)

1. **Go to Google Search Console:**
   - Visit: https://search.google.com/search-console/welcome
   - Enter your domain: `jobs.mattlelonek.co.uk`
   - Click "Continue"

2. **Choose "HTML tag" verification method**

3. **Copy the verification meta tag**
   - You'll see something like:
   ```html
   <meta name="google-site-verification" content="YOUR_VERIFICATION_CODE" />
   ```

4. **Add it to your site:**
   - I'll add this to `index.html` once you provide the code
   - Or you can add it manually to `index.html` in the `<head>` section

5. **Verify:**
   - Click "Verify" in Google Search Console
   - Wait for site to redeploy on Netlify
   - Google will check your site and confirm ownership

### Method 2: HTML File Upload (Alternative)

1. **Download the verification file** from Google Search Console
2. **Upload to your site:**
   - Place the file in the `public/` folder
   - Commit and push to GitHub
   - Wait for Netlify to deploy
   - The file will be accessible at: `https://jobs.mattlelonek.co.uk/googleXXXXXXX.html`

3. **Click "Verify"** in Google Search Console

### Method 3: Netlify DNS (If you manage DNS on Netlify)

1. **Choose "Domain name provider" method**
2. **Copy the TXT record** provided by Google
3. **Add to Netlify DNS:**
   - Go to your Netlify site dashboard
   - Navigate to "Domain management" → "DNS"
   - Add a TXT record with the verification code
4. **Wait 10-60 minutes** for DNS propagation
5. **Click "Verify"**

## After Domain Verification

Once verified, you can proceed with OAuth verification:

1. **Update OAuth Consent Screen:**
   - App name: `Job Hunt Assistant` ✅ (already matches)
   - Homepage URL: `https://jobs.mattlelonek.co.uk` ✅ (verified)
   - Privacy Policy URL: `https://jobs.mattlelonek.co.uk/privacy-policy.html` ✅
   - Terms of Use URL: `https://jobs.mattlelonek.co.uk/terms-of-use.html` ✅

2. **Submit for Verification:**
   - Google will review your app (1-5 business days)
   - They'll check:
     - Domain ownership ✅
     - Privacy policy is accessible ✅
     - App name matches ✅
     - OAuth scopes are appropriate
     - App description is clear

## Current Status

✅ Privacy Policy link added to homepage (footer)
✅ App name updated to "Job Hunt Assistant"
⏳ Domain ownership verification (needs your action)

## Next Steps

1. **Provide me with the Google verification meta tag** OR
2. **Download the verification HTML file and I'll add it** OR
3. **Complete DNS verification yourself if you prefer**

Once verification is complete, wait for Netlify to redeploy (automatic, ~2 minutes), then click "Verify" in Google Search Console.
