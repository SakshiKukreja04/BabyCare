const { auth } = require('../firebaseAdmin');

/**
 * Middleware to verify Firebase ID token from Authorization header
 * Attaches decoded user to req.user
 * Rejects unauthenticated requests with 401
 */
const verifyToken = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or invalid Authorization header',
      });
    }

    const token = authHeader.split('Bearer ')[1];

    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing token',
      });
    }

    // Verify token using Firebase Admin SDK
    const decodedToken = await auth.verifyIdToken(token);

    // Get user record to check provider
    let providerData = [];
    try {
      const userRecord = await auth.getUser(decodedToken.uid);
      providerData = userRecord.providerData || [];
    } catch (error) {
      console.warn('Could not fetch user provider data:', error.message);
    }

    // Check if user signed up with Google
    const isGoogleUser = providerData.some(
      (provider) => provider.providerId === 'google.com'
    );

    // Attach user info to request
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name,
      isGoogleUser: isGoogleUser,
      providerData: providerData,
    };

    next();
  } catch (error) {
    console.error('Token verification error:', error.message);
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token',
    });
  }
};

module.exports = {
  verifyToken,
};

