// api/auth/callback.js
const fetch = require('node-fetch');
const { serialize } = require('cookie');

module.exports = async (req, res) => {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get authorization code from request body
  const { code } = req.body;
  
  if (!code) {
    return res.status(400).json({ error: 'Missing authorization code' });
  }

  // Log that we received a code (for debugging)
  console.log('Received authorization code:', code);

  try {
    console.log('Attempting to exchange code for token...');
    console.log('Using client ID:', process.env.PATREON_CLIENT_ID?.substring(0, 10) + '...');
    console.log('Redirect URI:', 'https://career-mode-tools.vercel.app/callback.html');
    
    // Exchange code for token with Patreon API
    const tokenResponse = await fetch('https://www.patreon.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        client_id: process.env.PATREON_CLIENT_ID,
        client_secret: process.env.PATREON_CLIENT_SECRET,
        redirect_uri: 'redirect_uri: 'https://career-mode-tools.vercel.app/callback.html'
      })
    });

    const tokenData = await tokenResponse.json();
    
    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', JSON.stringify(tokenData));
      return res.status(400).json({ 
        error: 'Failed to exchange code for token', 
        details: tokenData,
        status: tokenResponse.status,
        statusText: tokenResponse.statusText
      });
    }

    console.log('Successfully exchanged code for token');
    
    // Get user's membership info
    const membershipResponse = await fetch('https://www.patreon.com/api/oauth2/v2/identity?include=memberships', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    const userData = await membershipResponse.json();
    
    // Check if user is a patron
    const isPatron = userData.data?.relationships?.memberships?.data?.length > 0;
    
    // For testing purposes: Allow any logged-in user to access
    if (!isPatron) {
      // Check if we have a user ID at all, which means authentication worked
      if (userData.data?.id) {
        console.log('User authenticated but is not a patron. Allowing access for testing.');
        // Continue with authentication as if they were a patron
      } else {
        return res.status(403).json({ authenticated: false, error: 'Not a patron' });
      }
    }

    // Set auth cookie (expires in 7 days)
    const authToken = tokenData.access_token;
    res.setHeader('Set-Cookie', serialize('auth_token', authToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
      sameSite: 'Lax'
    }));

    return res.status(200).json({ authenticated: true });
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({ 
      error: 'Server error during authentication', 
      details: error.message,
      stack: error.stack
    });
  }
};
