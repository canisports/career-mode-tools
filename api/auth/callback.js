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
    
    // Build the request parameters for Patreon
    const params = new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      client_id: process.env.PATREON_CLIENT_ID,
      client_secret: process.env.PATREON_CLIENT_SECRET,
      redirect_uri: 'https://career-mode-tools.vercel.app/callback.html'
    });
    
    console.log('Request params:', params.toString());
    
    // Exchange code for token with Patreon API
    const tokenResponse = await fetch('https://www.patreon.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });
    
    // Log response status and headers for debugging
    console.log('Token response status:', tokenResponse.status);
    console.log('Token response headers:', JSON.stringify([...tokenResponse.headers.entries()]));
    
    // Safely get response text first
    const responseText = await tokenResponse.text();
    console.log('Raw response text:', responseText);
    
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
    console.log('User data received:', JSON.stringify(userData));
    
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
      message: error.message,
      stack: error.stack
    });
  }
};
