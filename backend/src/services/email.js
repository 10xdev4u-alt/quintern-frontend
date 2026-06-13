'use strict';
// =============================================================================
//  Email service — Resend API (replaces legacy nodemailer/SMTP)
// =============================================================================
//  Uses Resend (resend.com) for transactional email delivery.
//  Free tier: 3,000 emails/month, 100 emails/day.
//
//  When RESEND_API_KEY is not set, falls back to console.log so local dev
//  never crashes on email sends — just check the server logs.
// =============================================================================

const config = require('../config');
const path = require('path');
const fs = require('fs');

// ---- In-memory rate-limit + bounce tracking ----
const rateLimitMap = new Map();
const bounceList = new Set();
const metrics = { sent: 0, failed: 0, bounced: 0, retried: 0 };

class EmailService {
  constructor() {
    this._resend = null;
    this.templates = {};
    this._loadTemplates();
  }

  // ── Template loading (unchanged) ──────────────────────────────────────────
  _loadTemplates() {
    const dir = path.join(__dirname, 'templates');
    if (!fs.existsSync(dir)) return;
    for (const file of fs.readdirSync(dir)) {
      if (file.endsWith('.html') || file.endsWith('.txt')) {
        const name = file.replace(/\.(html|txt)$/, '');
        const ext = file.endsWith('.html') ? 'html' : 'txt';
        if (!this.templates[name]) this.templates[name] = {};
        this.templates[name][ext] = fs.readFileSync(
          path.join(dir, file),
          'utf-8'
        );
      }
    }
  }

  // ── Resend client (lazy init) ─────────────────────────────────────────────
  async _getClient() {
    if (this._resend) return this._resend;
    if (!config.email.resendApiKey) return null;

    // Dynamic import handles both CJS and ESM environments. If Resend ships
    // as ESM-only (common for modern SDKs), `require()` would throw — but
    // `import()` works everywhere.
    try {
      const { Resend } = await import('resend');
      this._resend = new Resend(config.email.resendApiKey);
      return this._resend;
    } catch (e) {
      console.warn('[Email] Failed to load Resend client:', e.message);
      return null;
    }
  }

  // ── Rate limit ────────────────────────────────────────────────────────────
  _checkRateLimit(to) {
    const now = Date.now();
    const windowMs = config.email.rateLimitWindowMs || 60000;
    const max = config.email.rateLimitPerRecipient || 5;
    if (!rateLimitMap.has(to)) rateLimitMap.set(to, []);
    const timestamps = rateLimitMap.get(to).filter((t) => now - t < windowMs);
    if (timestamps.length >= max) {
      throw new Error(`Rate limit exceeded for ${to}`);
    }
    timestamps.push(now);
    rateLimitMap.set(to, timestamps);
  }

  // ── Bounce check ──────────────────────────────────────────────────────────
  _checkBounce(to) {
    if (bounceList.has(to)) {
      throw new Error(`Bounced address suppressed: ${to}`);
    }
  }

  // ── Template rendering ────────────────────────────────────────────────────
  _render(templateName, data) {
    const tpl = this.templates[templateName];
    if (!tpl) return { html: null, text: null };

    const render = (str) => {
      if (!str) return null;
      return str
        .replace(/\{\{(\w+)\}\}/g, (_, k) => (data[k] != null ? data[k] : ''))
        .replace(
          /\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
          (_, k, content) =>
            data[k]
              ? content.replace(/\{\{(\w+)\}\}/g, (__, kk) =>
                  data[kk] != null ? data[kk] : ''
                )
              : ''
        );
    };

    return {
      html: render(tpl.html),
      text: render(tpl.txt),
    };
  }

  _stripHtml(html) {
    return html
      ? html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
      : '';
  }

  // ── Core send ─────────────────────────────────────────────────────────────
  async send({ to, subject, template, data, html, text }) {
    if (!to || !subject) throw new Error('Missing required fields: to, subject');
    this._checkBounce(to);
    this._checkRateLimit(to);

    let htmlContent = html;
    let textContent = text;

    if (template) {
      const rendered = this._render(template, { ...data, to, subject });
      htmlContent = htmlContent || rendered.html;
      textContent = textContent || rendered.text;
    }

    if (!htmlContent && !textContent) {
      textContent = ' ';
    }

    const mailFrom = config.email.from || 'noreply@quintern.com';

    const client = await this._getClient();
    if (!client) {
      // ── Console fallback (no API key configured) ──
      console.log(
        `[Email] Placeholder -> To: ${to}, Subject: "${subject}" (set RESEND_API_KEY to send real emails)`
      );
      metrics.sent++;
      return { messageId: 'console-' + Date.now(), accepted: [to], rejected: [] };
    }

    // ── Resend send with retry ──
    const maxRetries = config.email.retryMax || 3;
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          metrics.retried++;
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          await new Promise((r) => setTimeout(r, delay));
        }

        const { data: result, error } = await client.emails.send({
          from: mailFrom,
          to,
          subject,
          text: textContent || (htmlContent ? this._stripHtml(htmlContent) : ''),
          html: htmlContent || undefined,
        });

        if (error) {
          // Resend returns errors as a structured object, not a thrown exception
          throw new Error(error.message || 'Resend API error');
        }

        metrics.sent++;
        return {
          messageId: result?.id || 'resend-' + Date.now(),
          accepted: [to],
          rejected: [],
        };
      } catch (err) {
        lastError = err;
        console.error(
          `[Email] Attempt ${attempt + 1}/${maxRetries + 1} failed for ${to}: ${err.message}`
        );

        // Treat 4xx as non-retryable (bad address, invalid domain, etc.)
        if (err.statusCode && err.statusCode < 500) {
          bounceList.add(to);
          metrics.bounced++;
          break;
        }
      }
    }

    metrics.failed++;
    console.error(
      `[Email] All attempts failed for ${to}: ${lastError?.message}`
    );
    throw lastError || new Error(`Failed to send email to ${to}`);
  }

  // ── Convenience methods ───────────────────────────────────────────────────
  async sendPasswordReset(email, resetToken) {
    const resetLink = `${
      process.env.APP_URL || 'http://localhost:5173'
    }/reset-password#token=${encodeURIComponent(resetToken)}`;
    return this.send({
      to: email,
      subject: 'Quintern - Password Reset Request',
      template: 'password-reset',
      data: { resetLink, email },
    });
  }

  async sendAccountVerification(email, verificationToken) {
    const verifyLink = `${
      process.env.APP_URL || 'http://localhost:5173'
    }/verify-email?token=${verificationToken}`;
    return this.send({
      to: email,
      subject: 'Quintern - Verify Your Email',
      template: 'account-verification',
      data: { verifyLink, email },
    });
  }

  async sendNotification(email, { title, message, actionUrl, actionText }) {
    return this.send({
      to: email,
      subject: `Quintern - ${title}`,
      template: 'notification',
      data: { title, message, actionUrl, actionText },
    });
  }

  // ── Metrics & admin ───────────────────────────────────────────────────────
  getMetrics() {
    return { ...metrics };
  }

  resetMetrics() {
    metrics.sent = 0;
    metrics.failed = 0;
    metrics.bounced = 0;
    metrics.retried = 0;
  }

  _clearRateLimits() {
    rateLimitMap.clear();
  }

  _trackBounce(address) {
    bounceList.add(address);
  }

  _clearBounceList() {
    bounceList.clear();
  }
}

module.exports = new EmailService();
