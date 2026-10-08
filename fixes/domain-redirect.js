/**
 * fixes/domain-redirect.js
 * herokuapp.com → https://rcdxmini.dexterid.org (301, keeps path + query)
 *
 * Usage (put this FIRST, before your routes, in site/index.js):
 *   const domainRedirect = require('./fixes/domain-redirect');
 *   domainRedirect(app);
 */

const PUBLIC_URL = (process.env.PUBLIC_URL || 'https://rcdxmini.dexterid.org').replace(/\/$/, '');

function domainRedirect(app) {
  // Heroku sits behind a router/load balancer — trust it for req.protocol/secure
  app.set('trust proxy', 1);

  app.use((req, res, next) => {
    const host = (req.headers.host || '').toLowerCase();

    // Redirect the default Heroku domain to the custom domain
    if (/\.herokuapp\.com$/i.test(host)) {
      return res.redirect(301, PUBLIC_URL + req.originalUrl);
    }
    next();
  });

  console.log(`↪️  redirect ${'*.herokuapp.com'} → ${PUBLIC_URL}`);
}

module.exports = domainRedirect;
