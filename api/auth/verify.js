// api/auth/verify.js
const fetch = require('node-fetch');
const { parse } = require('cookie');

module.exports = async (req, res) => {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get auth token from cookies
  const cookies = parse(req.headers.cookie || '');
  const authToken = cookies.auth_token;

  if (!authToken) {
    return res.status(401).json({ authenticated: false, error: 'No auth token' });
  }

  try {
    // Verify token with Patreon
    const response = await fetch('https://www.patreon.com/api/oauth2/v2/identity?include=memberships', {
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      return res.status(401).json({ authenticated: false, error: 'Invalid token' });
    }

    const userData = await response.json();
    
    // Check if user is a patron
    const isPatron = userData.data?.relationships?.memberships?.data?.length > 0;
    
    if (!isPatron) {
      return res.status(403).json({ authenticated: false, error: 'Not a patron' });
    }

    return res.status(200).json({ authenticated: true });
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(500).json({ error: 'Server error during verification' });
  }
};
