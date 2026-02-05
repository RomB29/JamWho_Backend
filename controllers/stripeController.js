const User = require('../models/User');

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY non configurée. Ajoutez-la dans le .env du backend.');
  }
  return require('stripe')(key);
}

/**
 * Vérifie le statut d'une session Stripe Checkout (après retour Payment Link)
 * Si status === 'complete', synchronise l'utilisateur premium en BDD (au cas où le webhook n'a pas encore été reçu).
 * GET /api/stripe/checkout-session/:sessionId
 */
exports.getCheckoutSessionStatus = async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) {
      return res.status(400).json({ message: 'sessionId requis' });
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'subscription.items.data.price']
    });

    let expiresAt = null;
    const subscriptionId = session.subscription?.id || session.subscription || null;

    if (session.status === 'complete' && subscriptionId) {
      const subscription = typeof session.subscription === 'object' && session.subscription?.current_period_end
        ? session.subscription
        : await stripe.subscriptions.retrieve(subscriptionId);
      if (subscription?.current_period_end) {
        expiresAt = new Date(subscription.current_period_end * 1000).toISOString();
      }
      // Synchroniser l'utilisateur en BDD (au cas où le webhook n'a pas encore été reçu)
      const customerEmail = session.customer_details?.email || session.customer_email;
      if (customerEmail) {
        const user = await User.findOne({ email: customerEmail.toLowerCase() });
        if (user) {
          const current_period_start = subscription.items.data[0].current_period_start;
          const current_period_end = subscription.items.data[0].current_period_end;
          user.isPremium = true;
          user.stripeCustomerId = session.customer || user.stripeCustomerId;
          user.stripeSubscriptionId = subscriptionId;
          user.premiumStartedAt = new Date(current_period_start * 1000);
          user.premiumExpiresAt = new Date(current_period_end * 1000);
          if (expiresAt) user.premiumExpiresAt = new Date(expiresAt);
          if (subscription?.current_period_start) {
            user.premiumStartedAt = new Date(subscription.current_period_start * 1000);
          }
          const interval = subscription?.items?.data?.[0]?.price?.recurring?.interval;
          if (interval === 'week') user.premiumPlanType = 'weekly';
          else if (interval === 'month') user.premiumPlanType = 'monthly';
          await user.save();
        }
      }
    }

    res.json({
      status: session.status,
      subscriptionId: subscriptionId || null,
      expiresAt
    });
  } catch (error) {
    console.error('[Stripe] Erreur récupération session:', error.message);
    const message = error.message || 'Erreur lors de la vérification de la session';
    const status = error.type === 'StripeAuthenticationError' ? 503 : 500;
    res.status(status).json({
      message: message,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Crée une session du portail client Stripe (gérer abonnement, carte, annuler)
 * POST /api/stripe/create-portal-session
 * Body: { returnUrl: string }
 */
exports.createPortalSession = async (req, res) => {
  try {
    const stripe = getStripe();
    const { returnUrl } = req.body;
    if (!returnUrl) {
      return res.status(400).json({ message: 'returnUrl requis' });
    }

    const user = await User.findById(req.user._id);
    if (!user || !user.stripeCustomerId) {
      return res.status(400).json({
        message: 'Aucun abonnement Stripe associé. Passez Premium pour accéder au portail.'
      });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: returnUrl
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('[Stripe] Erreur création portail:', error.message);
    res.status(500).json({
      message: 'Erreur lors de la création du portail',
      error: error.message
    });
  }
};

/**
 * Webhook Stripe - DOIT utiliser express.raw() pour le body (signature)
 * Gère checkout.session.completed, customer.subscription.updated/deleted
 */
exports.handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('[Stripe] STRIPE_WEBHOOK_SECRET non configuré');
    return res.status(500).send('Webhook non configuré');
  }

  const stripe = getStripe();
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('[Stripe] Signature webhook invalide:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        await handleCheckoutCompleted(session);
        break;
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        await handleSubscriptionUpdated(subscription);
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        await handleSubscriptionDeleted(subscription);
        break;
      }
      case 'invoice.payment_succeeded':
      case 'invoice.payment_failed':
        // Optionnel : logs ou notifications
        break;
      default:
        console.log(`[Stripe] Événement non géré: ${event.type}`);
    }
  } catch (err) {
    console.error('[Stripe] Erreur traitement webhook:', err);
    return res.status(500).send('Erreur traitement webhook');
  }

  res.json({ received: true });
};

async function handleCheckoutCompleted(session) {
  const stripe = getStripe();
  const customerEmail = session.customer_details?.email || session.customer_email;
  if (!customerEmail) {
    console.error('[Stripe] checkout.session.completed sans email');
    return;
  }

  const user = await User.findOne({ email: customerEmail.toLowerCase() });
  if (!user) {
    console.error('[Stripe] Utilisateur non trouvé pour email:', customerEmail);
    return;
  }

  const customerId = session.customer || session.customer_details?.id;
  const subscriptionId = typeof session.subscription === 'string'
    ? session.subscription
    : session.subscription?.id;

  user.isPremium = true;
  user.stripeCustomerId = customerId || user.stripeCustomerId;
  user.stripeSubscriptionId = subscriptionId || user.stripeSubscriptionId;

  if (subscriptionId) {
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['items.data.price']
      });
      if (subscription.current_period_end) {
        user.premiumExpiresAt = new Date(subscription.current_period_end * 1000);
      }
      if (subscription.current_period_start) {
        user.premiumStartedAt = new Date(subscription.current_period_start * 1000);
      }
      const interval = subscription?.items?.data?.[0]?.price?.recurring?.interval;
      if (interval === 'week') user.premiumPlanType = 'weekly';
      else if (interval === 'month') user.premiumPlanType = 'monthly';
    } catch (e) {
      console.warn('[Stripe] Impossible de récupérer la période abonnement:', e.message);
    }
  }

  await user.save();
  console.log('[Stripe] Premium activé pour userId:', user._id);
}

async function handleSubscriptionUpdated(subscription) {
  const customerId = subscription.customer;
  const user = await User.findOne({ stripeCustomerId: customerId });
  if (!user) return;

  const now = new Date();
  const periodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000)
    : null;
  // Conserver les droits premium jusqu'à la fin de la période même si annulation (cancel_at_period_end)
  const isActive =
    ['active', 'trialing'].includes(subscription.status) ||
    (subscription.status === 'canceled' && periodEnd && periodEnd > now);

  user.isPremium = isActive;
  user.stripeSubscriptionId = subscription.id;
  user.premiumExpiresAt = periodEnd;
  await user.save();
}

async function handleSubscriptionDeleted(subscription) {
  const customerId = subscription.customer;
  const user = await User.findOne({ stripeCustomerId: customerId });
  if (!user) return;

  user.isPremium = false;
  user.stripeSubscriptionId = null;
  user.premiumExpiresAt = null;
  user.premiumStartedAt = null;
  user.premiumPlanType = null;
  await user.save();
  console.log('[Stripe] Premium désactivé pour userId:', user._id);
}
