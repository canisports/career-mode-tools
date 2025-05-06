// Create a new file in your Vercel project under `/api/patreon.js`

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const code = req.body.code;

  const client_id = 'MLI_vPPd-j_mSmOWRyFccmyWxnfBEofm-1F3I2KpECegq3pARRhFR_sYC01a7yx4';
  const client_secret = process.env.PATREON_CLIENT_SECRET; // Store in Vercel Env Variables
  const redirect_uri = 'https://canisports.vercel.app/callback';

  try {
    // Step 1: Exchange code for access token
    const tokenRes = await fetch('https://www.patreon.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        client_id,
        client_secret,
        redirect_uri
      })
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      return res.status(400).json({ error: 'Invalid token exchange' });
    }

    // Step 2: Use access token to get user info
    const userRes = await fetch('https://www.patreon.com/api/oauth2/v2/identity?include=memberships&fields%5Bmember%5D=patron_status', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`
      }
    });

    const userData = await userRes.json();

    const isActive = userData?.included?.some(m => m.attributes.patron_status === 'active_patron');

    return res.status(200).json({ patron: isActive });

  } catch (err) {
    console.error('Patreon Auth Error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
} 

// In Vercel, go to Project > Settings > Environment Variables
// Add a variable: PATREON_CLIENT_SECRET = your actual client secret
