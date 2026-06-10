# World-Class Enterprise eCommerce Platform — Master Development Plan

## Context

SB Store is a Frappe v16 + ERPNext v16 + React 19 eCommerce platform with three portals (customer/seller/admin), 60+ API endpoints, COD + payment stubs, loyalty, gift cards, reviews, PAN KYC, and a glassmorphic dark/light UI. It is currently **70% production-ready backend, 85% frontend** but has 7 confirmed critical security vulnerabilities, no real payment gateway, no SMS OTP, no multi-tenancy, no Docker/CI-CD, and no monitoring.

**Why this plan exists:** The platform has strong architectural bones (ERPNext-native order lifecycle, multi-portal React app, Indian-first features) but cannot safely accept real payments or serve multiple brands/domains. This plan transforms it into a world-class, multi-tenant, enterprise-grade eCommerce ecosystem — the only commerce platform where every rupee of every order is also an ERPNext accounting entry.

---

## Part 1: Market & Competitive Intelligence

### Indian eCommerce Landscape 2026

| Incumbent | Weakness (exploitable) |
|---|---|
| Flipkart / Meesho / Amazon | Closed marketplaces — D2C brands can't own storefront |
| Shopify India | No native GST/TDS/TCS, no INR-first ERP, 2-4% bleed per order |
| Magento / Adobe Commerce | ₹40K+ annual license, no Indian payment defaults |
| Unicommerce | OMS bolt-on only, not a primary system of record |
| WooCommerce | Poor scalability, no native inventory management |
| VTEX / Commercetools | No India presence, no ERPNext integration |

**White space:** No platform handles GST compliance, multi-seller payouts, B2B credit terms, and full ERP (ledgers, inventory) natively in one system. SB Store occupies this category exclusively.

### Target Segments & TAM

| Segment | Count | Price Point | TAM |
|---|---|---|---|
| D2C Brands (50–500 SKUs) | 120K brands | ₹5K–25K/mo | ₹7,200 Cr/yr |
| Multi-Vendor Marketplace Operators | 8K verticals | ₹20K–1L/mo | ₹960 Cr/yr |
| B2B Wholesale / MSME Distributors | 2.5M distributors | ₹8K–40K/mo | ₹24,000 Cr/yr |

**SAM (3-year):** ₹500–1,000 Cr ARR at 0.5% TAM capture with 50-person team.
**Market growth:** 28% CAGR 2024–2028 (GST digitisation + ONDC acceleration).

---

## Part 2: Product Vision & Roadmap

### Vision
> "The only commerce platform where every rupee of every order is also an accounting entry — built for India, by India, on open source."

### Positioning
**"ERPNext Commerce Layer"** — makes ERPNext's accounting, inventory, CRM, and HR accessible to end customers and sellers without touching the ERPNext desk.

### North Star Metric
**GMV per active store per month** → Target: ₹10 lakh GMV/store/month by Year 2.

### 3-Year Roadmap

**Year 1 — Platform Foundation:** Security hardening, Razorpay gateway, SMS OTP, multi-tenant SaaS shell, GST on invoices, Docker + CI/CD, seller payout automation
**Year 2 — Commerce Depth:** B2B portal (credit terms, GSTIN invoicing), WhatsApp commerce, vernacular Hindi/Bengali/Tamil/Marathi, AI recommendations, ONDC seller node, PWA
**Year 3 — Network Effects:** Full marketplace orchestration, logistics API hub, AI merchandising copilot, white-label SaaS for SI partners, international expansion (Bangladesh, Sri Lanka)

---

## Part 3: User Personas & Customer Journeys

### Persona 1 — Priya, Mobile-First B2C Shopper
- 24 yrs, Pune, smartphone-only, ₹35K/mo income
- Pain: Cart wiped if browser cleared (`CartContext.tsx` localStorage), no real SMS OTP (`checkout.py:25` returns OTP in response), no Hindi labels
- Journey: Social ad → product listing → variant select → OTP checkout → order tracking → return
- Conversion triggers: flash sale countdown, low-stock badge (`actual_qty` missing from `get_all_products`), one-tap UPI

### Persona 2 — Rahul, D2C Brand Owner
- 34 yrs, Delhi, 200-SKU men's grooming brand, Shopify + Zoho + CA today
- Pain: No bulk SKU upload (200 manual entries), GST not calculated (`checkout.py` creates SI without tax templates), seller analytics skeleton
- Journey: Onboard → bulk import → first order → GST invoice → payout → analytics
- Conversion trigger: "Works with ERPNext you already use", "GST-compliant invoices auto-generated", "30-min onboarding"

### Persona 3 — Meera, Marketplace Operator
- 42 yrs, Mumbai, 150 artisan-sellers, PHP platform that crashed
- Pain: All sellers see all products (no data isolation), no commission model, no seller approval workflow, no GSTIN on checkout
- Journey: Seller recruit → GSTIN validation → product approval → order routing → payout
- Conversion trigger: "Automated TDS deduction on payouts", "GSTIN-based B2B invoicing", self-service seller onboarding

### Persona 4 — Vikram, Enterprise B2B Buyer
- 48 yrs, Coimbatore, procurement manager, needs GSTIN invoices for ITC
- Pain: No bulk pricing tiers (all buyers see Standard Selling), no credit terms, no HSN codes in API, GST not calculated
- Journey: Catalogue browse → bulk add to cart → PO with GSTIN → credit-term invoice → ITC claim
- Conversion trigger: "Downloadable IRN e-invoice", "Net-30 credit terms", "Bulk order data for your ERP"

### Persona 5 — Ananya, Platform Admin (SaaS Operator)
- 29 yrs, CTO of Frappe SI partner managing 12 client stores
- Pain: Single `home_page = "shop"` in `hooks.py` (one store per site), `get_site_config` reads global Website Settings (no per-tenant isolation), no Docker, no CI/CD
- Journey: Client requirements → store provision → branding config → go-live → monitoring → update deploy
- Conversion trigger: "Docker Compose one-command deploy", "Per-site branding without code changes", "White-label custom domain"

---

## Part 4: Feature Prioritization (MoSCoW, 3 Phases)

### Phase 1 — MVP+ Security & Commerce Foundation (Months 1–3)

**Must Have (P0/P1 — nothing ships without these):**

1. **Remove OTP from API response** — `checkout.py:25`, `registration.py:43`; integrate MSG91 API
2. **Razorpay HMAC payment verification** — new `api/payment_gateway.py`; replace blind `update_payment_status` trust
3. **Remove CSRF bypass** — `utils.py`; replace with `X-Requested-With` header + SameSite Strict cookie
4. **Remove `frappe.set_user("Administrator")` for guests** — create `Store Guest` role with minimum DocPerm (Item read, Price read)
5. **Remove card storage** — `customer.py`; replace `saved_cards_json` with Razorpay tokenization
6. **Rate limiting** — Redis sliding window in `utils.py:before_request`; 60 req/min per IP
7. **`actual_qty` in `get_all_products` response** — 1-line backend change; `ProductCard.tsx` already handles it
8. **GST tax template selection** — `_checkout_create_sales_order`; CGST+SGST intra-state, IGST inter-state via `india_compliance`
9. **Server-side cart** — new `EC Cart` DocType; sync `CartContext.tsx` to backend; enables abandoned cart recovery

**Should Have:**
- Docker Compose dev environment + Dockerfile
- GitHub Actions CI pipeline (Ruff lint + ESLint + bench tests + Vite build)
- Sentry error tracking (Python + React)
- CSP + security headers via Nginx
- `width`/`height` on all `<img>` tags (CLS fix)
- SEO metadata injection in `www/shop.py` for product/category pages

**Could Have:**
- Shiprocket/Delhivery AWB number on Delivery Note
- Stock reservation (15-min Redis TTL on cart add)

### Phase 2 — Growth: Multi-Seller, B2B, Analytics (Months 4–9)

**Must Have:**
1. **Multi-tenant store provisioning** — Frappe multi-site; per-tenant Nginx vhost + wildcard SSL; `EC Tenant Settings` DocType
2. **Seller data isolation** — add `supplier` custom field to `Item`; filter `get_all_products`/`get_admin_products` by session user's Supplier
3. **Seller analytics API** — `api/seller_analytics.py`; feed `SellerAnalytics.tsx` skeleton (date-filtered revenue, top products, return rate)
4. **B2B buyer portal** — GSTIN on checkout; B2B price list switching; IRN e-invoice via `india_compliance`; `/b2b` route
5. **WhatsApp notifications** — 4 templates (order placed/shipped/delivered/return approved) via Meta Cloud API; config-flip-ready
6. **Custom domain + SSL** — per-store via Nginx vhost + certbot in Docker stack

**Should Have:**
- Referral program (`ReferralCode` DocType)
- Product Q&A DocType
- Hindi UI translations (50 key strings via `src/i18n/`)
- Server-side pagination UI (total count added to `get_all_products`)
- Async email via Frappe RQ (currently blocks request in `email_notifications.py`)
- PWA manifest + service worker

**Could Have:**
- Meilisearch integration for typo-tolerant product search
- Webhook system (`EC Webhook` DocType) for order/payment events

### Phase 3 — Enterprise: AI, Marketplace, Mobile (Months 10–18)

**Must Have:**
1. **AI product recommendations** — item-item CF on Sales Order co-occurrence; `Product Recommendation` DocType; `api/products.py:get_recommendations()`
2. **ONDC seller node** — register as BAP/BPP; map ERPNext Items to ONDC catalogue; access 60M ONDC buyers
3. **Full vernacular UI** — Hindi/Bengali/Tamil/Marathi via `src/i18n/` with `Noto Sans`/`Hind` font loading
4. **React Native mobile app** — Expo + RN; reuse same Frappe API; same TypeScript types
5. **Marketplace payout automation** — weekly Frappe job: delivered orders → commission deduction → Supplier Purchase Invoice → TDS Journal Entry → WhatsApp payout summary
6. **Next.js 15 migration** — SSG for product pages, ISR for category pages, CSR for checkout/profile (SEO critical)

**Should Have:**
- Semantic search (multilingual-e5-small + Meilisearch vector search)
- Claude API RAG chatbot for customer support
- Fraud detection (rule-based → Isolation Forest)
- Inventory forecasting (Prophet model per item)
- Customer RFM segmentation (weekly batch job)
- Dynamic pricing engine

---

## Part 5: UI/UX Strategy & Design System

### Design Philosophy
Three pillars: **Conversion**, **Premium**, **Accessible**. Evolve existing glassmorphic dark theme with gold `#F7C948` into a proper design system — do NOT rewrite.

### Current Design System Inventory
Already defined in `frontend/src/styles/index.css`:
- Colors: `--primary`, `--accent (#F7C948)`, `--text-main`, `--text-dim`, `--glass`, `--glass-border`, `--shadow`
- Z-indices: `--z-navbar:50`, `--z-dropdown:100`, `--z-modal:200`, `--z-toast:300`
- Transition: `--transition: all 0.3s cubic-bezier(0.645, 0.045, 0.355, 1)`

**Missing tokens (add to `index.css`):**
```css
--space-1: 4px through --space-16: 64px   /* 4px base grid */
--text-xs: 12px through --text-5xl: 48px  /* type scale */
--radius-sm: 4px, --radius-md: 8px, --radius-lg: 12px, --radius-full: 9999px
--color-success: #22c55e, --color-error: #ef4444, --color-warning: #f59e0b
--brand: #F7C948  /* immutable — never change in light mode */
```

### Component Library (new `src/design-system/`)
Collapse 33 scattered CSS files into reusable primitives:
- `Button` (variant: primary/secondary/ghost/danger) → replaces `.premium-btn`, `.quick-add-btn`, `.card-add-to-cart-btn`
- `Badge` → replaces `.category-badge`, `.sold-out-badge`, `.variant-badge`
- `Skeleton` → unified shimmer across all pages
- `Modal` (consistent z-index `--z-modal`)
- `Input` / `Select` / `Textarea` with `aria-label` + `:focus-visible` ring
- `Toast` → style the existing `ToastContext.tsx`

### Responsive Breakpoints (replace single 640px breakpoint)
```css
--bp-xs: 480px   /* large phones */
--bp-sm: 640px   /* landscape phones */
--bp-md: 768px   /* tablets */
--bp-lg: 1024px  /* laptops */
--bp-xl: 1280px  /* desktops */
--bp-2xl: 1600px /* wide screens */
```
Product grid: 1-col mobile → 2-col phone → 3-col tablet → 4-col desktop.

### Core Web Vitals Budget (also SEO signal)
| Metric | Target | Fix |
|---|---|---|
| LCP | < 2.5s | Move Hero to `<img>` with `fetchpriority="high"` (not CSS bg) |
| FID/INP | < 100ms | `useMemo` on search filter; `useMemo`/`useCallback` in CartContext |
| CLS | < 0.1 | Add explicit `width`/`height` or `aspect-ratio: 1/1.2` on all product images |

### Accessibility (WCAG 2.1 AA)
- Fix `--text-dim: #8892B0` contrast (3.8:1 fails AA) → darken to `#9aa0b8`
- Add `:focus-visible` ring: `outline: 2px solid var(--brand); outline-offset: 2px`
- Add `<a href="#main-content">Skip to content</a>` in `Navbar.tsx`
- All images: `alt={product.name}` (not empty)

### i18n Architecture (Phase 2)
```
src/i18n/
  translations/en.ts  hi.ts  bn.ts  ta.ts  mr.ts
```
Hook: `useTranslation()` backed by React Context; locale in `localStorage` + Frappe session lang. Start with 50 high-frequency strings: category names, CTAs, order status, checkout prompts.

Fonts: Load `Noto Sans` (Devanagari) + `Hind` (Bengali/Tamil) only when locale is active.

---

## Part 6: Technical Architecture

### Stack (retain + evolve)
| Layer | Current | Evolution |
|---|---|---|
| Backend | Frappe v16 + ERPNext v16 | Add `api/v1/` versioning; Rate limiter; Meilisearch sidecar |
| Database | MariaDB (Frappe ORM) | Read replica; 6 critical indexes; partition Sales Order by year |
| Cache | Redis (Frappe sessions) | Product catalog cache 5-min TTL; search cache |
| Frontend | React 19 + Vite 5 + React Router 7 | Add design system; Phase 3 → Next.js 15 SSG |
| Search | None (substring in Python) | Meilisearch (typo-tolerant, vector search, multilingual) |
| Payments | COD + metadata stubs | Razorpay Orders API + HMAC + webhooks |
| SMS OTP | OTP in HTTP response (broken) | MSG91 OTP API |
| Container | None | Docker Compose → Phase 4: Kubernetes |
| CDN | None | Cloudflare (DDoS + image resize + edge cache) |
| Monitoring | None | Sentry + OTel + Grafana/Loki |

### Multi-Tenant Architecture: Frappe Multi-Site (One Bench)

**Strategy:** One `bench` manages N sites. Each site = separate ERPNext instance = complete data isolation.

```
sites/
  platform.localhost/          # super-admin ops site
  tenant-{slug}.storefront.com/  # SaaS subdomain per tenant
  mybrand.com/                 # custom domain white-label
```

**DNS routing:** Frappe reads `HTTP_HOST` → `sites/{host}/site_config.json`. Wildcard SSL via certbot DNS-01 on `*.storefront.com`. Per-custom-domain via Let's Encrypt HTTP-01.

**Tenant provisioning flow:**
1. Platform admin calls `POST /api/tenants/provision`
2. Runs: `bench new-site {slug}.storefront.com --install-app store_customizations --install-app erpnext --install-app india_compliance`
3. Seeds: company, warehouse, price list, roles, `Store Guest` role
4. Configures `site_config.json` with secrets
5. Nginx vhost reload (zero downtime via `nginx -s reload`)

**Per-tenant isolation:**
- Branding: per-site `Website Settings`
- Currency/tax: ERPNext per-company tax config
- Payment methods: per-site `Payment Gateway Account`
- Feature flags: new `EC Tenant Settings` DocType

### API Architecture

**Keep REST** (not GraphQL — Frappe's `@frappe.whitelist` RPC pattern is idiomatic, GraphQL adds N+1 complexity with no compelling benefit).

**Versioning:** Add `api/v1/` prefix for all new endpoints. Old paths remain during deprecation window. Response header: `X-API-Version: 1`.

**Rate limiting** (Redis sliding window in `utils.py:before_request`):
```python
# 60 req/min per IP for public endpoints
# 120 req/min per authenticated user
# Configurable per-tenant in EC Tenant Settings
```

**Background jobs** (convert sync → async via Frappe RQ):
- Email notifications (currently blocks request)
- Meilisearch index sync
- Webhook delivery (new `EC Webhook` DocType)
- Stock recalculation
- Report generation

### Database Indexes (add via ERPNext patches)
```sql
ALTER TABLE `tabItem` ADD INDEX idx_item_group_disabled (item_group, disabled);
ALTER TABLE `tabItem` ADD INDEX idx_variant_of_disabled (variant_of, disabled);
ALTER TABLE `tabSales Order` ADD INDEX idx_so_customer_date (customer, transaction_date);
ALTER TABLE `tabSales Invoice Item` ADD INDEX idx_sii_sales_order (sales_order);
ALTER TABLE `tabPayment Entry Reference` ADD INDEX idx_per_ref_name (reference_name);
ALTER TABLE `tabStock Alert` ADD INDEX idx_sa_item_notified (item_code, is_notified);
```

Sales Order range partitioning by year (after ERPNext table creation):
```sql
ALTER TABLE `tabSales Order` PARTITION BY RANGE (YEAR(transaction_date)) (...);
```

### New Custom DocTypes
| DocType | Purpose |
|---|---|
| `EC Cart` | Server-side persistent cart (replaces localStorage-only) |
| `EC Tenant Settings` | Per-tenant branding + feature flags |
| `EC Payment Token` | Razorpay/Stripe token references (NO card data) |
| `EC Webhook` | Webhook subscription + delivery log |
| `EC Product Recommendation` | AI-computed item-item suggestions |
| `EC Reconciliation Log` | Payment gateway vs ERPNext daily reconciliation |
| `Seller Commission` | Per-order commission splits for marketplace payouts |

---

## Part 7: Security Architecture

### P0 Fixes (Week 1-2 — absolute blockers)

**Fix 1: Remove OTP from HTTP response**
```python
# checkout.py:25 — REMOVE: return {"otp": otp, ...}
# REPLACE: call MSG91 API, return only {"message": "OTP sent"}
# Dev mode: write OTP to server log file only (never HTTP response)
```

**Fix 2: Razorpay HMAC payment verification**
```python
# New: api/payment_gateway.py
def verify_razorpay_payment(order_id, payment_id, signature) -> bool:
    body = f"{order_id}|{payment_id}"
    expected = hmac.new(razorpay_key_secret, body, sha256).hexdigest()
    return hmac.compare_digest(expected, signature)

# update_payment_status must require razorpay_signature param
# Webhook handler validates X-Razorpay-Signature header FIRST
```

**Fix 3: Remove CSRF bypass**
```python
# utils.py — delete bypass_csrf_for_checkout entirely
# hooks.py — remove before_request bypass
# site_config.json: {"session_cookie_samesite": "Strict", "session_cookie_secure": true}
# Note: checkout.py already calls get_csrf_token() in client.ts — bypass is redundant
```

**Fix 4: Replace Administrator guest access**
```python
# Create "Store Guest" role with minimum DocPerm:
# Item: Read, Item Price: Read, Website Item: Read, Website Slideshow: Read
# Remove frappe.set_user("Administrator") from all 17 guest endpoints
# Pattern: use Store Guest role + frappe.db.get_value without ignore_permissions
```

**Fix 5: Remove card storage**
```python
# customer.py — delete saved_cards_json field usage
# Replace with: store only {razorpay_customer_id, token_id, last4, network}
# New EC Payment Token DocType — Razorpay holds PCI-sensitive data
```

### P1 Fixes (Week 3-4)

**Rate limiting:** Redis sliding window in `before_request` (see API Architecture above)

**Fix `secrets.randbelow` for gift cards:**
```python
# _helpers.py:_generate_pin() — replace random.randint with secrets.randbelow
```

**Authorization decorator** (replaces 75 `ignore_permissions=True` occurrences):
```python
def require_roles(*roles):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            if not any(r in frappe.get_roles() for r in roles):
                frappe.throw("Not permitted", frappe.PermissionError)
            return fn(*args, **kwargs)
        return wrapper
    return decorator
```

### Security Headers (Nginx)
```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' https://checkout.razorpay.com; connect-src 'self' https://api.razorpay.com;" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

---

## Part 8: Payment Integration Architecture

### Razorpay (Primary — India)
```
1. Frontend → create_razorpay_order (backend) → Razorpay Order created → returns {order_id, amount, key_id}
2. Frontend loads Razorpay checkout.js with order_id
3. On success → {razorpay_payment_id, razorpay_order_id, razorpay_signature} returned
4. Frontend → verify_payment (backend) → HMAC validated → Payment Entry in ERPNext
5. Webhook: payment.captured → idempotent Payment Entry creation
```

### Payment Ecosystem (Phase-wise)
| Gateway | Phase | Use Case |
|---|---|---|
| Razorpay | 1 | Default India — cards + UPI + BNPL via one SDK |
| PhonePe S2S API | 2 | UPI deep links, lower MDR |
| COD with OTP verification | 1 (existing) | Last-mile COD confirmation |
| Stripe | 3 | International merchants |
| ZestMoney / LazyPay | 3 | BNPL |

**Refund automation:** `initiate_refund()` → Razorpay refund API → ERPNext return Sales Invoice (existing `orders.py` pattern).

**Daily reconciliation job:** Pull Razorpay settlement report → match against Payment Entry `reference_no` → alert on mismatches via `EC Reconciliation Log`.

---

## Part 9: DevOps, CI/CD & Infrastructure

### Docker Architecture
```yaml
# docker-compose.yml services
frappe-web        # Gunicorn + Frappe + store_customizations
frappe-worker     # RQ worker (default + short + long queues)
frappe-scheduler  # beat scheduler
mariadb           # MariaDB 10.6
redis-cache       # frappe.cache()
redis-queue       # Frappe RQ
meilisearch       # search engine sidecar
nginx             # reverse proxy + static assets
certbot           # SSL renewal
```

### CI/CD Pipeline (GitHub Actions)
```
Triggers: push + pull_request

Jobs (parallel):
  lint-python:    ruff check store_customizations/
  lint-frontend:  cd frontend && npm ci && npm run lint
  test-backend:   bench run-tests --app store_customizations (MariaDB + Redis as services)
  test-frontend:  cd frontend && npm test -- --coverage

  build-docker:   (needs all lint+test)
    - docker build + push to registry on main branch

  deploy-staging: (needs build-docker, main branch only)
    - kubectl set image + rollout status

  deploy-production: (needs deploy-staging, requires manual approval)
    - kubectl set image (rolling update, maxUnavailable: 0)
    - bench migrate (on pod exec)
```

### Environments
- **dev:** Docker Compose locally, `.env.dev`
- **staging:** Auto-deploy on main merge, uses prod-like data snapshot
- **production:** Manual gate approval, rolling Kubernetes deployment

### Secrets Management
- Phase 1-2: GitHub Secrets → Kubernetes Secrets → env vars in `site_config.json`
- Phase 4: HashiCorp Vault with Vault Agent Sidecar for automatic secret rotation

---

## Part 10: Performance & Scalability

### Frontend Performance
| Optimization | Action | File |
|---|---|---|
| LCP | Move Hero bg-image to `<img fetchpriority="high">` | `Hero.tsx` |
| CLS | `aspect-ratio: 1/1.2` on product images | `ProductCard.css` |
| INP | Debounce search handler (400ms); `useMemo` in CartContext | `Navbar.tsx`, `CartContext.tsx` |
| Bundle | Already lazy-loaded seller/admin routes; target < 150KB gzipped | `App.tsx` |

### CDN Strategy (Cloudflare)
- All static assets: long-lived cache headers (1 year with hash filenames ✓)
- Product images: Cloudflare Image Resizing → WebP auto-conversion
- API responses: Cache `get_all_products` at edge — `Cache-Control: public, max-age=300, stale-while-revalidate=60`
- API cache purge: `doc_events` on Item update → Cloudflare Cache Purge API

### Redis Product Catalog Cache
```python
cache_key = f"ec:products:{item_group}:{limit}:{offset}"
frappe.cache().set_value(cache_key, result, expires_in_sec=300)
# Invalidation: Item.on_update → frappe.cache().delete_keys("ec:products:*")
```

### Load Targets (k6)
- 1000 concurrent users on product listing
- p95 latency < 500ms
- p99 latency < 1s
- Zero 5xx at 500 RPS

### Phase 3: Next.js 15 Migration (SSR/SSG)
- Product pages: SSG (pre-built at deploy time)
- Category pages: ISR (5-min revalidation)
- Checkout / profile / orders: CSR (unchanged React 19)
- Admin / seller portals: CSR (unchanged)
- Hosted as separate Node.js process behind Nginx (alongside Frappe Gunicorn)

---

## Part 11: Monitoring & Observability

### Stack
| Tool | Purpose | Integration |
|---|---|---|
| Sentry | Error tracking Python + JS | `sentry_sdk` in hooks.py; `@sentry/react` in App.tsx |
| OpenTelemetry | Distributed tracing | WSGI middleware; `trace_id` in all API responses |
| Loki + Grafana | Log aggregation (staging) | Docker sidecar; `structlog` structured logging |
| Datadog | APM + logs (production) | OTel export; unified traces + metrics |
| BetterUptime | Uptime + SSL monitoring | Ping `/api/method/frappe.utils.ping` |
| Custom Grafana | Business metrics dashboard | Read replica queries |

### Business Metrics Dashboard
GMV (daily/weekly/monthly), conversion rate (requires `EC Cart` DocType for cart creation tracking), AOV, cart abandonment, payment method distribution, top products by revenue, seller GMV breakdown.

### Alerting (PagerDuty)
| Alert | Threshold | Severity |
|---|---|---|
| Payment verification failure rate | > 1% | P0 |
| API error rate (5xx) | > 0.5% | P0 |
| p95 API latency | > 1s for 5 min | P1 |
| OTP delivery failure rate | > 5% | P1 |
| Redis memory | > 80% | P1 |
| MariaDB slow queries | > 10/min | P2 |

---

## Part 12: Testing Strategy

### Backend (migrate to pytest)
```python
# conftest.py
@pytest.fixture(autouse=True)
def frappe_test_env():
    frappe.set_user("Administrator")
    yield
    frappe.db.rollback()
```

Priority test suites:
1. `test_checkout_flow.py` — OTP → place_order → payment verification full lifecycle
2. `test_payment_gateway.py` — HMAC verification, webhook handling, refund flow
3. `test_permissions.py` — Guest cannot access admin; Customer cannot see others' orders
4. `test_rate_limiting.py` — Rate limiter triggers at threshold
5. `test_multi_tenant.py` — Cross-site data isolation

### Frontend (Vitest + Testing Library + MSW)
Add to `package.json`: `vitest`, `@testing-library/react`, `@testing-library/user-event`, `msw` (API mocking)
Priority: CartContext logic, checkout step transitions, payment verification flow.

### E2E (Playwright)
Critical paths: complete checkout flow, login/signup, order tracking, admin product management, seller analytics.

### API Contracts (Schemathesis)
```bash
schemathesis run http://localhost:8100/api/openapi.json --checks=all --hypothesis-max-examples=100
```

### Coverage Targets
| Layer | Target |
|---|---|
| Python backend | 80% (pytest-cov) |
| TypeScript frontend | 60% (Vitest) |
| E2E critical paths | 100% of checkout/login/orders |

---

## Part 13: AI & Automation Opportunities

### Phase 3 — Prioritized by ROI

**1. Product Recommendations (item-item CF)**
- Data: Sales Order Items co-occurrence matrix
- Algorithm: cosine similarity on purchase vectors
- Serve: Redis-cached per `item_code`; cold-start fallback: same `item_group`
- New endpoint: `api/products.py:get_recommendations(item_code, limit=5)`

**2. Semantic Search**
- Model: `multilingual-e5-small` (90MB, Hindi+English product names)
- Store: Meilisearch vector search (v1.6+)
- Hybrid: keyword + semantic, RRF re-ranking
- Sync: `Item.on_update` → Frappe RQ → Meilisearch index

**3. Claude API RAG Customer Support Chatbot**
```python
# claude-sonnet-4-6 for customer support
from anthropic import Anthropic
client = Anthropic()
# Knowledge base: product catalog + FAQ + shipping policy (Meilisearch)
# Context: customer's recent orders + account status
# Model: claude-haiku-4-5-20251001 for fast/cheap responses
```

**4. Inventory Forecasting (Prophet)**
- Weekly batch job per item_code
- Features: day_of_week, month, is_holiday (Indian calendar), price_change
- Output: reorder_point + suggested_reorder_qty stored in Item custom fields

**5. Fraud Detection**
- Phase 3: Rule-based flags (same device + multiple failed OTPs + >5 orders/day/IP)
- Phase 4: Isolation Forest on order features

**6. Customer RFM Segmentation**
- Weekly batch job: Recency/Frequency/Monetary scoring
- Segments stored as Customer tags → marketing automation input

**7. Review Sentiment Analysis**
- `distilbert-base-multilingual-cased-sentiments-student` model
- Tag reviews: positive/negative/neutral + aspect extraction (shipping/quality/price)
- Aggregate per item for admin dashboard insights

---

## Part 14: SEO & Growth Strategy

### Technical SEO — Fix SPA Crawlability (Phase 1)

**Phase 1: Metadata injection in `www/shop.py`**
For `/product/<item_code>`: inject `<title>`, `<meta name="description">`, `<link rel="canonical">`, JSON-LD `Product` schema from `frappe.get_doc("Item", item_code)`.

**Phase 2: Prerendering** via `rendertron` middleware — serve pre-rendered HTML to `User-Agent: Googlebot`.

**Phase 3: Next.js 15 SSG** — complete SSR solution; product pages indexed in first crawl.

### Schema.org Structured Data
- `Product`: name, image, description, sku, brand, offers (price, availability, seller)
- `BreadcrumbList`: Home > Category > Product
- `AggregateRating`: from `reviews.py:get_item_reviews` (already returns `avg_rating` + count)

### Sitemap
New `www/sitemap.xml.py`: dynamic sitemap from active ERPNext Items + category pages. Submit to Google Search Console on each new store setup.

### Growth Flywheel
```
Frappe community (200K users) → open-source install
       ↓
Frappe SI partner upsells to D2C client
       ↓  
D2C brand generates GMV → platform fee revenue
       ↓
Revenue → AI features + WhatsApp + mobile app
       ↓
Richer features → larger marketplace operators
       ↓
Marketplace operators bring 100+ sellers → network effect
       ↓
Seller success stories → more inbound leads
```

### Distribution Channels
1. **Frappe Community** — publish on `frappe.io/apps`; every SI partner is a potential customer
2. **D2C Brand Communities** — `D2C Insider`, `founders.club`, Shark Tank India alumni
3. **SI Affiliate Program** — 30% revenue share for 12 months per onboarded client
4. **ONDC Visibility** — ONDC registration = both a feature AND distribution via 60M ONDC-enabled buyers

---

## Part 15: Monetization & Subscription Models

### SaaS Tiers

| Tier | Price | Target | Limits |
|---|---|---|---|
| Starter | ₹4,999/mo | D2C brands, <50 SKUs | 1 seller, basic analytics, 1% GMV fee above ₹2L/mo |
| Growth | ₹14,999/mo | D2C brands, 500 SKUs | Multi-user, no transaction fee, advanced analytics |
| Enterprise | ₹49,999/mo | Marketplaces, B2B portals | 100+ sellers, 0.3% GMV for payout processing |
| Platform | ₹1,50,000+/mo | White-label SaaS resellers | Pure license, no GMV fee |

**Annual discount:** 20% (standard SaaS; improves cash flow).

### Add-On Modules

| Module | Price |
|---|---|
| AI Analytics (forecasting, cohort LTV) | ₹5,000/mo |
| WhatsApp Commerce (order notifications + campaigns) | ₹3,000/mo |
| Logistics Hub (Shiprocket/Delhivery AWB + SLA alerts) | ₹2,500/mo |
| ONDC Node (BAP/BPP registration + catalogue sync) | ₹8,000/mo |
| B2B Portal (credit terms, GSTIN invoicing) | ₹6,000/mo |
| Vernacular Pack (Hindi/Bengali/Tamil/Marathi) | ₹1,500/mo |

### Year 2 Revenue Projection
| Tier | Stores | MRR | ARR |
|---|---|---|---|
| Starter | 500 | ₹24.95L | ₹2.99Cr |
| Growth | 150 | ₹22.50L | ₹2.70Cr |
| Enterprise | 30 | ₹14.99L | ₹1.80Cr |
| Add-ons (avg ₹4K/store, 300 stores) | 300 | ₹12.00L | ₹1.44Cr |
| **Total** | **980** | **₹74.44L** | **₹8.93Cr ARR** |

---

## Part 16: Timeline & Milestones

### Phase 1 — Security & Foundation (Months 1–3)
| Week | Milestone |
|---|---|
| 1 | P0 security fixes: OTP in response, Razorpay HMAC, CSRF bypass |
| 2 | P0 security fixes: Store Guest role, card storage removal |
| 3 | Rate limiting, security headers (CSP), `actual_qty` in products API |
| 4 | GST tax template selection; server-side cart (`EC Cart` DocType) |
| 5–6 | Docker Compose + Dockerfile; GitHub Actions CI pipeline |
| 7–8 | Sentry + OTel integration; business metrics dashboard v1 |
| 9–10 | SEO metadata injection in `www/shop.py`; JSON-LD structured data |
| 11–12 | Design system token completion; `Button`/`Badge`/`Input` components |

**Phase 1 exit criteria:** Can safely accept real Razorpay payments; Docker deploys in one command; zero P0/P1 security issues.

### Phase 2 — Multi-Seller & B2B (Months 4–9)
| Month | Milestone |
|---|---|
| 4–5 | Frappe multi-site setup; Nginx wildcard SSL; `EC Tenant Settings` |
| 5–6 | Seller data isolation (supplier field on Item); seller analytics API |
| 6–7 | B2B portal (GSTIN on checkout, B2B price list, IRN e-invoice) |
| 7–8 | Meilisearch integration; Hindi UI translations (50 strings) |
| 8–9 | WhatsApp notifications (4 templates); PWA manifest |

**Phase 2 exit criteria:** Multi-tenant provisioning < 1 hour; seller portal fully functional with isolated data; B2B buyer can generate GST-compliant e-invoice.

### Phase 3 — Enterprise & AI (Months 10–18)
| Month | Milestone |
|---|---|
| 10–11 | AI product recommendations (item-item CF) |
| 11–12 | ONDC seller node registration + catalogue sync |
| 12–13 | Full vernacular UI (Hindi/Bengali/Tamil/Marathi) |
| 13–14 | Next.js 15 migration (product SSG, category ISR) |
| 14–15 | React Native mobile app (Expo, cart + checkout + orders) |
| 15–16 | Marketplace payout automation (TDS-aware) |
| 16–18 | Claude API RAG chatbot; semantic search; fraud detection |

---

## Part 17: Team Structure & Resource Planning

### Phase 1 Team (Months 1–3) — 4 people
- **1 Backend Engineer** — security fixes, Razorpay, GST, server-side cart
- **1 DevOps Engineer** — Docker, CI/CD, Nginx, monitoring
- **1 Frontend Engineer** — design system, Core Web Vitals fixes, SEO metadata
- **1 QA / Security** — penetration testing, checkout E2E, rate limiter tests

### Phase 2 Team (Months 4–9) — 8 people
- Add: **1 Backend Engineer** (multi-tenant, B2B portal)
- Add: **1 Full-Stack Engineer** (seller portal, analytics APIs)
- Add: **1 Product Designer** (i18n, B2B UX, WhatsApp templates)
- Add: **1 Sales / Customer Success** (Frappe partner onboarding)

### Phase 3 Team (Months 10–18) — 15 people
- Add: **2 ML Engineers** (recommendations, search, fraud, forecasting)
- Add: **1 Mobile Engineer** (React Native Expo)
- Add: **1 DevOps / SRE** (Kubernetes, Vault, Datadog)
- Add: **2 Sales Engineers** (ONDC integration, enterprise deals)
- Add: **1 Content / Community** (Frappe community, D2C brand outreach)

---

## Part 18: Risk Analysis & Mitigation

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Razorpay integration bugs in production | High | Critical | Full test coverage in Razorpay test mode before go-live; webhook handler idempotency |
| Frappe version upgrade breaking custom code | Medium | High | Pin Frappe version in requirements; integration test suite in CI |
| GST rate change breaking tax templates | Medium | Medium | `india_compliance` app handles rate changes; no hardcoded rates in code |
| Multi-site data isolation breach | Low | Critical | Per-site MariaDB DBs (Frappe default); cross-site pen test before launch |
| MSG91 SMS delivery failure → OTP unavailable | Medium | High | Fallback to email OTP; SMS provider SLA monitoring |
| Razorpay webhook replay attack | Low | High | Store `razorpay_payment_id` in `EC Payment Token`; check for duplicate before processing |
| Next.js migration breaks existing React | Medium | Medium | Incremental migration: SSG product pages first, keep checkout as CSR |
| Kubernetes complexity overwhelming small team | Medium | Medium | Stick with Docker Compose until Phase 4; K8s only when horizontal scale needed |
| ONDC spec changes invalidating integration | Medium | Medium | Monitor ONDC changelog; abstract ONDC client behind interface |
| AI recommendation quality poor at low GMV | High | Low | Cold-start fallback: same item_group; activate CF only after 10K orders |

---

## Part 19: Post-Launch Support & Continuous Improvement

### Month 1–3 Post-Launch
- **On-call rotation** — P0 incident response < 15 min (PagerDuty)
- **Weekly** — review Sentry error report; address top 5 bugs
- **Bi-weekly** — GMV + conversion rate review; A/B test results
- **Security** — rotate all API keys/secrets post-launch; run OWASP ZAP scan

### Quarterly Rhythm
- **Q1** — Performance audit (k6 load test); Core Web Vitals check; dependency updates
- **Q2** — Security audit (OWASP Top 10 checklist); penetration test by external firm
- **Q3** — Customer satisfaction survey (NPS); feature request prioritization
- **Q4** — Annual roadmap planning; team growth assessment; competitive landscape review

### Continuous Improvement Loop
```
Monitor (Grafana/Sentry/Datadog)
       ↓
Identify degradation (alert or weekly review)
       ↓
Root cause in code (git blame + OTel trace)
       ↓
Fix + test + deploy (< 24h for P0, < 1 week for P1)
       ↓
Post-mortem (P0 only) → add regression test
       ↓
Update runbook / documentation
```

### SLA Commitments per Tier
| Tier | Uptime SLA | Support Response |
|---|---|---|
| Starter | 99.5% | Email, 2 business days |
| Growth | 99.9% | Email + ticket, 8 hours |
| Enterprise | 99.95% | Dedicated Slack, 2 hours |
| Platform | 99.99% | 24/7 phone, < 30 min |

---

## Part 20: Verification & Testing Plan

### Phase 1 Verification
1. **Security:** Run OWASP ZAP scan against staging — zero high/critical findings
2. **Payments:** Complete Razorpay test-mode checkout flow (card + UPI + webhook); verify HMAC rejection on tampered signature
3. **OTP:** Confirm `checkout.py` response body contains no OTP field; verify MSG91 delivery to test mobile
4. **Docker:** `docker-compose up` → site accessible; `docker-compose down && up` → data persists
5. **CI/CD:** Push to main → GitHub Actions runs all jobs → staging deployment completes
6. **Performance:** k6 test: 200 concurrent users, p95 < 500ms on `/api/method/store_customizations.api.products.get_all_products`

### Phase 2 Verification
1. **Multi-tenant:** Provision 2 test tenants; verify Item created on tenant A is NOT visible on tenant B
2. **Seller isolation:** Login as Supplier on tenant → `get_admin_products` returns only that supplier's Items
3. **GST:** Place order with intra-state address → Sales Invoice has CGST + SGST (9%+9%); inter-state → IGST (18%)
4. **B2B:** Enter GSTIN on checkout → B2B price list activates; IRN generated and returned in order confirmation

### Phase 3 Verification
1. **Recommendations:** After 100+ test orders seeded, `get_recommendations("ITEM-001")` returns 5 relevant items (not the item itself)
2. **Next.js SSG:** `curl -A "Googlebot" https://staging/product/ITEM-001` → returns full HTML with JSON-LD structured data
3. **Mobile app:** Expo app runs on Android emulator; complete checkout flow; order appears in web admin

---

## Critical Files for Phase 1 Implementation

| File | Changes |
|---|---|
| `store_customizations/api/checkout.py` | Remove OTP from response; add Razorpay HMAC; remove `frappe.set_user("Administrator")` |
| `store_customizations/api/registration.py` | Remove OTP from response; integrate MSG91 |
| `store_customizations/utils.py` | Delete CSRF bypass; add rate limiter |
| `store_customizations/hooks.py` | Remove `before_request` CSRF bypass; add `Item.on_update` → cache invalidation + Meilisearch sync |
| `store_customizations/api/customer.py` | Remove `saved_cards_json`; add `EC Payment Token` CRUD |
| `store_customizations/api/_helpers.py` | Fix `secrets.randbelow` for PIN generation; add input validators |
| `store_customizations/api/payment_gateway.py` | NEW: Razorpay Orders + verify + webhook handler |
| `frontend/src/styles/index.css` | Add spacing/typography/semantic color tokens; fix `--text-dim` contrast |
| `frontend/src/App.tsx` | Wire `EC Cart` sync; add Sentry ErrorBoundary |
| `docker-compose.yml` | NEW: full service stack |
| `.github/workflows/ci.yml` | NEW: lint + test + build + deploy pipeline |
