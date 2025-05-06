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

  console.log('Received authorization code:', code);

  try {
    console.log('Attempting to exchange code for token...');
    
    // Get credentials from environment variables
    const clientId = process.env.PATREON_CLIENT_ID;
    const clientSecret = process.env.PATREON_CLIENT_SECRET;
    
    // Create HTTP Basic Auth header
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    // Build the request parameters for Patreon
    const params = new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      redirect_uri: 'https://career-mode-tools.vercel.app/callback.html'
    });
    
    console.log('Request params:', params.toString());
    
    // Exchange code for token with Patreon API using Basic Auth
    const tokenResponse = await fetch('https://www.patreon.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });
    
    // Log response status and headers for debugging
    console.log('Token response status:', tokenResponse.status);
    
    // Safely get response text first
    const responseText = await tokenResponse.text();
    console.log('Raw response text (truncated):', responseText.substring(0, 100));
    
    let tokenData;
    try {
      // Then try to parse as JSON
      tokenData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse response as JSON:', parseError);
      return res.status(500).json({ 
        error: 'Failed to parse Patreon response', 
        rawResponse: responseText.substring(0, 500) // Limit length for security
      });
    }
    
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
    console.log('Access token received (truncated):', tokenData.access_token.substring(0, 10) + '...');
    
    // Get user's membership info
    const membershipResponse = await fetch('https://www.patreon.com/api/oauth2/v2/identity?include=memberships', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    // Similarly, get raw text first then parse
    const membershipText = await membershipResponse.text();
    
    let userData;
    try {
      userData = JSON.parse(membershipText);
    } catch (parseError) {
      console.error('Failed to parse membership response:', parseError);
      return res.status(500).json({
        error: 'Failed to parse membership data',
        rawResponse: membershipText.substring(0, 500) // Limit length for security
      });
    }
    
    // For testing: Allow any user to access
    console.log('User data received:', JSON.stringify(userData).substring(0, 100) + '...');
    
    // Create a patreonAuthenticated flag for client-side check
    const clientFlag = 'true';
    
    // Set multiple cookies for better persistence
    
    // 1. Auth token (HTTP-only for security)
    res.setHeader('Set-Cookie', [
      // Auth token - HTTP-only for security
      serialize('auth_token', tokenData.access_token, {
        httpOnly: true,
        secure: true,
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
        sameSite: 'Lax'
      }),
      // Authenticated flag - can be read by JavaScript
      serialize('patreonAuthenticated', clientFlag, {
        httpOnly: false,
        secure: true,
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
        sameSite: 'Lax'
      }),
      // User ID for reference
      serialize('patreonUserId', userData.data?.id || 'unknown', {
        httpOnly: false,
        secure: true,
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
        sameSite: 'Lax'
      })
    ]);

    // Also save to localStorage in case cookies don't work well
    return res.status(200).json({ 
      authenticated: true,
      storeInLocalStorage: true,
      userId: userData.data?.id || 'unknown'
    });
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({ 
      error: 'Server error during authentication', 
      message: error.message,
      stack: error.stack
    });
  }
};
