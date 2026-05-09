import { useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';

const ORANGE = '#F4521E';
const ORANGE_L = '#FF7A4D';
const GREEN = '#1A7A3C';
const YELLOW = '#F9C13A';
const CREAM = '#FDF6EC';
const DARK = '#0F0D0A';
const DARK2 = '#1C1A15';
const TEXT = '#2B2720';
const MUTED = '#7A6E65';
const BORDER = 'rgba(0,0,0,0.08)';

export default function Home() {
  return (
    <div style={{ background: CREAM, color: TEXT, fontFamily: "'DM Sans', sans-serif", overflowX: 'hidden' }}>
      <Navbar variant="cream" />
      <Hero />
      <Trust />
      <Services />
      <HowItWorks />
      <Reviews />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}

// ─── Hero ────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section style={{
      minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr 1fr',
      alignItems: 'center', padding: '100px 5% 60px',
      position: 'relative', overflow: 'hidden',
      background: DARK, gap: 40,
    }} className="cc-hero">
      {/* Decorative blobs */}
      <div style={{
        position: 'absolute', top: -100, right: -100, width: 600, height: 600,
        borderRadius: '50%', background: 'radial-gradient(circle, rgba(244,82,30,0.18), transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: -80, left: '30%', width: 400, height: 400,
        borderRadius: '50%', background: 'radial-gradient(circle, rgba(26,122,60,0.15), transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(244,82,30,0.15)', border: '1px solid rgba(244,82,30,0.3)',
          color: ORANGE_L, fontSize: 12, fontWeight: 500, letterSpacing: '0.8px',
          textTransform: 'uppercase', padding: '6px 14px', borderRadius: 999,
          marginBottom: 24, width: 'fit-content',
        }}>
          <span style={{ fontSize: 8 }}>●</span> Now live on UMaT, Tarkwa
        </div>
        <h1 style={{
          fontFamily: "'Syne', sans-serif", fontSize: 'clamp(40px, 5vw, 72px)',
          fontWeight: 800, lineHeight: 1.05, color: '#fff', letterSpacing: '-2px',
          marginBottom: 20,
        }}>
          Hot food,
          <br />
          <span style={{ color: ORANGE }}>right where<br />you are.</span>
        </h1>
        <p style={{
          fontSize: 16, color: 'rgba(255,255,255,0.6)',
          maxWidth: 420, marginBottom: 36, lineHeight: 1.7, fontWeight: 300,
        }}>
          Order from your favourite campus vendors — halls, lecture courts, staff quarters — and get it delivered in under 30 minutes. No stress, no queue.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 48 }}>
          <Link to="/menu" style={{
            background: ORANGE, color: '#fff',
            padding: '16px 32px', borderRadius: 999,
            fontWeight: 500, fontSize: 15, textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}>Order Food Now →</Link>
          <a href="#how" style={{
            background: 'transparent', color: 'rgba(255,255,255,0.8)',
            padding: '16px 32px', borderRadius: 999,
            fontWeight: 500, fontSize: 15, textDecoration: 'none',
            border: '1px solid rgba(255,255,255,0.15)',
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}>See how it works</a>
        </div>
        <div style={{ display: 'flex', gap: 32 }}>
          <Stat n="1,200+" l="Orders delivered" />
          <Stat n="18 min" l="Avg delivery time" />
          <Stat n="4.8★" l="Student rating" />
        </div>
      </div>

      <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }} className="cc-hero-visual">
        <div style={{
          background: DARK2, border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 24, padding: 28,
          width: '100%', maxWidth: 360,
          position: 'relative', zIndex: 2,
        }}>
          <div style={{
            width: '100%', height: 200, borderRadius: 16,
            background: 'linear-gradient(135deg, #2a1f1a 0%, #3d2b20 50%, #2a1f1a 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 64, marginBottom: 20, position: 'relative', overflow: 'hidden',
          }}>🍛</div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
            Jollof Rice + Chicken
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 16 }}>
            Mama Ama's Kitchen · Block C
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800, color: ORANGE }}>GHS 28</div>
            <div style={{
              background: 'rgba(249,193,58,0.12)', border: '1px solid rgba(249,193,58,0.25)',
              color: YELLOW, fontSize: 12, fontWeight: 500,
              padding: '4px 12px', borderRadius: 999,
            }}>⏱ ~18 min</div>
            <Link to="/menu" style={{
              width: 40, height: 40, borderRadius: '50%',
              background: ORANGE, color: '#fff', textDecoration: 'none',
              fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>+</Link>
          </div>
        </div>
        <div style={{
          position: 'absolute', top: '10%', right: '-10%',
          background: DARK2, border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 14, padding: '10px 14px',
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 13, fontWeight: 500, color: '#fff', whiteSpace: 'nowrap',
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#23A852' }} />
          Order confirmed!
        </div>
        <div style={{
          position: 'absolute', bottom: '20%', left: '-12%',
          background: DARK2, border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 14, padding: '10px 14px',
          fontSize: 13, fontWeight: 500, color: '#fff', whiteSpace: 'nowrap',
        }}>
          🛵 Rider is 3 min away
        </div>
      </div>
    </section>
  );
}

function Stat({ n, l }: { n: string; l: string }) {
  return (
    <div>
      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: -1 }}>{n}</div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.6 }}>{l}</div>
    </div>
  );
}

// ─── Trust ───────────────────────────────────────────────────────────────────

function Trust() {
  const items = [
    { icon: '✅', label: 'Verified campus vendors', tone: 'green' },
    { icon: '📡', label: 'Secure MoMo payments', tone: 'orange' },
    { icon: '⚡', label: 'No hidden delivery fees', tone: 'yellow' },
    { icon: '📍', label: 'Delivers anywhere on campus', tone: 'green' },
  ];
  const toneBg = { green: 'rgba(26,122,60,0.1)', orange: 'rgba(244,82,30,0.1)', yellow: 'rgba(249,193,58,0.12)' };

  return (
    <section style={{ padding: '32px 5%', background: '#fff', borderBottom: `1px solid ${BORDER}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 36, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: MUTED, textTransform: 'uppercase', letterSpacing: 1 }}>
          Trusted by students &amp; staff at
        </span>
        <div style={{ width: 1, height: 24, background: BORDER }} />
        {items.map((i) => (
          <div key={i.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 500, color: TEXT }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: toneBg[i.tone as keyof typeof toneBg],
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16,
            }}>{i.icon}</div>
            {i.label}
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Services ────────────────────────────────────────────────────────────────

function Services() {
  const services = [
    { icon: '🍽️', title: 'Wide menu selection', desc: 'Jollof, waakye, banku, fried rice, snacks, drinks and more — from vendors you already know on campus.', tag: '50+ items daily', accent: ORANGE },
    { icon: '⚡', title: 'Lightning-fast delivery', desc: 'Our campus riders know every hostel block by name. Average delivery in under 20 minutes.', tag: '~18 min average', accent: GREEN },
    { icon: '📱', title: 'Pay with Mobile Money', desc: 'MTN MoMo, Vodafone Cash, AirtelTigo — all supported. No card needed. Pay the way Ghana pays.', tag: '100% secure', accent: ORANGE, featured: true },
    { icon: '📍', title: 'Deliver anywhere on campus', desc: 'Drop off at your hostel room, library, or staff office. Pick your building from the list.', tag: 'All buildings', accent: YELLOW },
    { icon: '🔔', title: 'Live order tracking', desc: 'Know exactly where your food is — from kitchen to your door. Get SMS updates on low data.', tag: 'Real-time', accent: GREEN },
    { icon: '🪪', title: 'Are you a vendor?', desc: 'Get more orders without leaving your spot. Join CampusChoo and reach hundreds of students daily.', tag: 'List your food →', accent: ORANGE, link: '/account?redirect=/portal' },
  ];

  return (
    <section style={{ padding: '100px 5%', background: CREAM }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <SectionLabel color={ORANGE}>What we offer</SectionLabel>
        <SectionHeading>Everything you need, nothing you don't.</SectionHeading>
        <p style={{ fontSize: 16, color: MUTED, maxWidth: 500, marginBottom: 60 }}>
          Built specifically for campus life — fast, affordable, and designed around your schedule.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }} className="cc-services-grid">
          {services.map((s) => (
            <div key={s.title} style={{
              background: s.featured ? DARK : '#fff',
              border: s.featured ? '1px solid transparent' : `1px solid ${BORDER}`,
              borderRadius: 20, padding: 32,
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', top: 0, right: 0, width: 120, height: 120,
                borderRadius: '0 20px 0 120px', background: s.accent, opacity: 0.08,
              }} />
              <div style={{ fontSize: 36, marginBottom: 20, display: 'block' }}>{s.icon}</div>
              <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 10, color: s.featured ? '#fff' : DARK }}>
                {s.title}
              </h3>
              <p style={{ fontSize: 14, color: s.featured ? 'rgba(255,255,255,0.5)' : MUTED, lineHeight: 1.65 }}>
                {s.desc}
              </p>
              {s.link ? (
                <Link to={s.link} style={{
                  display: 'inline-block', marginTop: 16, textDecoration: 'none',
                  background: s.featured ? 'rgba(244,82,30,0.2)' : 'rgba(244,82,30,0.1)', color: ORANGE,
                  fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8,
                  padding: '4px 12px', borderRadius: 999,
                }}>{s.tag}</Link>
              ) : (
                <span style={{
                  display: 'inline-block', marginTop: 16,
                  background: s.featured ? 'rgba(244,82,30,0.2)' : 'rgba(244,82,30,0.1)', color: ORANGE,
                  fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8,
                  padding: '4px 12px', borderRadius: 999,
                }}>{s.tag}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── How It Works ────────────────────────────────────────────────────────────

function HowItWorks() {
  const steps = [
    { n: '01', icon: '🔍', title: 'Browse the menu', desc: 'Explore food from all campus vendors. Filter by cuisine, price, or delivery time.' },
    { n: '02', icon: '🛒', title: 'Add to cart', desc: 'Pick your items, select your building and room, add any notes to the vendor.' },
    { n: '03', icon: '📱', title: 'Pay with MoMo', desc: 'Checkout securely with mobile money. You\'ll get an instant order confirmation.' },
    { n: '04', icon: '🛵', title: 'Enjoy your food', desc: 'Your rider brings it straight to you. Track them live until they arrive.' },
  ];

  return (
    <section id="how" style={{ padding: '100px 5%', background: DARK, position: 'relative', overflow: 'hidden' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <SectionLabel color={ORANGE_L}>Simple process</SectionLabel>
        <SectionHeading dark>Order in three steps.</SectionHeading>
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.45)', maxWidth: 500, marginBottom: 48 }}>
          From hungry to eating — faster than a walk to the canteen.
        </p>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1,
          background: 'rgba(255,255,255,0.06)', borderRadius: 20, overflow: 'hidden',
        }} className="cc-steps-grid">
          {steps.map((s) => (
            <div key={s.n} style={{ background: DARK, padding: '36px 28px', position: 'relative' }}>
              <span style={{
                fontFamily: "'Syne', sans-serif", fontSize: 64, fontWeight: 800,
                color: 'rgba(255,255,255,0.05)',
                position: 'absolute', top: 12, right: 20, lineHeight: 1,
              }}>{s.n}</span>
              <span style={{ fontSize: 32, marginBottom: 16, display: 'block' }}>{s.icon}</span>
              <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: 17, fontWeight: 700, color: '#fff', marginBottom: 8 }}>
                {s.title}
              </h3>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Reviews ─────────────────────────────────────────────────────────────────

function Reviews() {
  const reviews = [
    { name: 'Ama Kyei', role: 'Level 300 · Business Admin', avatar: 'AK', text: '"I ordered jollof during a lecture break and it arrived before the break ended. I was genuinely shocked."', highlight: true },
    { name: 'Dr. Emmanuel Osei', role: 'Lecturer · Engineering', avatar: 'EO', text: '"As staff, I used to send my assistant for lunch. Now I order directly to my office. Saves so much time."' },
    { name: 'Princess Boateng', role: 'Level 200 · Nursing', avatar: 'PB', text: '"MoMo payment was smooth — no card drama. The order tracking kept me calm instead of wondering."' },
  ];

  return (
    <section style={{ padding: '100px 5%', background: CREAM }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 48, flexWrap: 'wrap', gap: 20 }}>
          <div>
            <SectionLabel color={ORANGE}>What people say</SectionLabel>
            <SectionHeading>Loved by students<br />and staff alike.</SectionHeading>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 64, fontWeight: 800, color: DARK, letterSpacing: -3, lineHeight: 1 }}>4.8</div>
            <div style={{ color: YELLOW, fontSize: 18, letterSpacing: 2, margin: '4px 0' }}>★★★★★</div>
            <div style={{ fontSize: 13, color: MUTED }}>from 340+ reviews</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }} className="cc-reviews-grid">
          {reviews.map((r) => (
            <div key={r.name} style={{
              background: r.highlight ? ORANGE : '#fff',
              border: r.highlight ? '1px solid transparent' : `1px solid ${BORDER}`,
              borderRadius: 20, padding: 28,
            }}>
              <div style={{ color: r.highlight ? 'rgba(255,255,255,0.8)' : YELLOW, fontSize: 14, letterSpacing: 2, marginBottom: 14 }}>★★★★★</div>
              <p style={{ fontSize: 15, lineHeight: 1.65, color: r.highlight ? 'rgba(255,255,255,0.9)' : TEXT, marginBottom: 20 }}>
                {r.text}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, fontWeight: 700,
                  background: r.highlight ? 'rgba(255,255,255,0.2)' : 'rgba(244,82,30,0.1)',
                  color: r.highlight ? '#fff' : ORANGE,
                  fontFamily: "'Syne', sans-serif", flexShrink: 0,
                }}>{r.avatar}</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: r.highlight ? '#fff' : DARK }}>{r.name}</div>
                  <div style={{ fontSize: 12, color: r.highlight ? 'rgba(255,255,255,0.6)' : MUTED }}>{r.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── FAQ ─────────────────────────────────────────────────────────────────────

function FAQ() {
  const items = [
    { q: 'How much does delivery cost?', a: 'Delivery is a flat fee of GHS 15 for all orders on campus — no surprises at checkout.' },
    { q: 'Which mobile money networks are accepted?', a: 'We accept MTN MoMo, Vodafone Cash, and AirtelTigo Money. Enter your number at checkout and approve the payment prompt on your phone.' },
    { q: 'Can I order for someone else on campus?', a: 'Yes! Just enter their building and room number as the delivery address. You\'ll both receive SMS updates.' },
    { q: 'What if my food arrives late or wrong?', a: 'Report it through the app or WhatsApp within 30 minutes of delivery and we\'ll refund or replace your order.' },
    { q: 'I\'m a vendor — how do I join?', a: 'Register an account as a Vendor and you can start adding menu items immediately.' },
    { q: 'Is CampusChoo available on weekends?', a: 'Yes — we operate 7 days a week from 7:30am to 12am. Vendor hours vary by day, so check their card for live status.' },
  ];

  const [open, setOpen] = useState(0);

  return (
    <section id="faq" style={{ padding: '100px 5%', background: '#fff' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 80, alignItems: 'start' }} className="cc-faq-grid">
        <div>
          <SectionLabel color={ORANGE}>Got questions?</SectionLabel>
          <SectionHeading>Everything answered.</SectionHeading>
          <p style={{ fontSize: 16, color: MUTED, marginBottom: 32 }}>
            Quick answers to the things students ask us most.
          </p>
          <div style={{ background: CREAM, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 24 }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6, color: DARK }}>Still not sure?</div>
            <div style={{ fontSize: 13, color: MUTED, marginBottom: 16 }}>Our team is on WhatsApp from 7:30am – 12am every day.</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <a href="https://wa.me/233591607971" style={whatsappBtn}>💬 0591607971</a>
              <a href="https://wa.me/233539807470" style={whatsappBtn}>💬 0539807470</a>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {items.map((item, i) => (
            <div key={item.q} style={{
              border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden', background: CREAM,
            }}>
              <button onClick={() => setOpen(open === i ? -1 : i)} style={{
                width: '100%', padding: '20px 24px',
                background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                fontSize: 15, fontWeight: 500, color: DARK, fontFamily: "'DM Sans', sans-serif",
              }}>
                {item.q}
                <span style={{
                  fontSize: 18, color: open === i ? ORANGE : MUTED,
                  transform: open === i ? 'rotate(45deg)' : 'rotate(0deg)',
                  transition: 'transform 0.3s',
                }}>+</span>
              </button>
              {open === i && (
                <div style={{ padding: '0 24px 20px', fontSize: 14, color: MUTED, lineHeight: 1.7 }}>
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Final CTA ───────────────────────────────────────────────────────────────

function FinalCTA() {
  return (
    <section style={{ padding: '120px 5%', background: DARK, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)', width: 700, height: 400,
        borderRadius: '50%',
        background: 'radial-gradient(ellipse, rgba(244,82,30,0.12), transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 700, margin: '0 auto' }}>
        <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: ORANGE, fontWeight: 600, marginBottom: 16 }}>
          Ready to eat?
        </div>
        <h2 style={{
          fontFamily: "'Syne', sans-serif", fontSize: 'clamp(40px, 6vw, 80px)',
          fontWeight: 800, lineHeight: 1, letterSpacing: -3, color: '#fff',
          marginBottom: 20,
        }}>
          Stop waiting.<br />
          <span style={{ color: ORANGE }}>Start ordering.</span>
        </h2>
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.45)', maxWidth: 440, margin: '0 auto 40px' }}>
          Join 1,200+ students and staff who never queue for food again.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 48 }}>
          <Link to="/menu" style={{
            background: ORANGE, color: '#fff', padding: '18px 40px', borderRadius: 999,
            fontWeight: 500, fontSize: 16, textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}>Order Food Now →</Link>
          <Link to="/account?redirect=/portal" style={{
            background: 'transparent', color: 'rgba(255,255,255,0.6)',
            padding: '18px 40px', borderRadius: 999,
            fontWeight: 500, fontSize: 16, textDecoration: 'none',
            border: '1px solid rgba(255,255,255,0.15)',
          }}>Register as a Vendor</Link>
        </div>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>
          No subscription. No commitment. <span style={{ color: 'rgba(255,255,255,0.5)' }}>Just great food, fast.</span>
        </p>
      </div>
    </section>
  );
}

// ─── Footer ──────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <>
      <footer style={{
        background: DARK2, borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: '48px 5%', display: 'grid',
        gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 40,
      }} className="cc-footer">
        <div>
          <Link to="/" style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 20, color: '#fff', textDecoration: 'none', display: 'inline-block', marginBottom: 12 }}>
            Campus<span style={{ color: ORANGE }}>Choo</span>
          </Link>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', lineHeight: 1.7, maxWidth: 240 }}>
            Fast, affordable food delivery built for campus life in Ghana. Order from your favourite vendors without leaving your room.
          </p>
        </div>
        <FooterCol title="Order" links={[
          { to: '/menu', label: 'Browse Menu' },
          { to: '/vendors', label: 'Our Vendors' },
          { to: '/track', label: 'Track Order' },
        ]} />
        <FooterCol title="For Vendors" links={[
          { to: '/account?redirect=/portal', label: 'Join CampusChoo' },
          { to: '/portal', label: 'Vendor Portal' },
        ]} />
        <FooterCol title="Support" links={[
          { to: 'https://wa.me/233591607971', label: 'WhatsApp Chat', external: true },
          { to: '/track', label: 'Track Order' },
        ]} />
      </footer>
      <div style={{
        background: DARK2, borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: '20px 5%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>© 2026 CampusChoo. All rights reserved.</p>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>Made for Ghanaian campuses 🇬🇭</p>
      </div>
    </>
  );
}

function FooterCol({ title, links }: { title: string; links: { to: string; label: string; external?: boolean }[] }) {
  return (
    <div>
      <h4 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: 'rgba(255,255,255,0.3)', marginBottom: 16, fontWeight: 600 }}>
        {title}
      </h4>
      <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {links.map((l) => (
          <li key={l.to + l.label}>
            {l.external ? (
              <a href={l.to} target="_blank" rel="noopener noreferrer" style={footerLink}>{l.label}</a>
            ) : (
              <Link to={l.to} style={footerLink}>{l.label}</Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

const footerLink: React.CSSProperties = { fontSize: 13, color: 'rgba(255,255,255,0.5)', textDecoration: 'none' };

const whatsappBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 8,
  background: '#25D366', color: '#fff', padding: '10px 20px', borderRadius: 999,
  fontSize: 14, fontWeight: 500, textDecoration: 'none',
};

function SectionLabel({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color, fontWeight: 600, marginBottom: 12 }}>
      {children}
    </div>
  );
}

function SectionHeading({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <h2 style={{
      fontFamily: "'Syne', sans-serif", fontSize: 'clamp(32px, 4vw, 52px)',
      fontWeight: 800, lineHeight: 1.1, letterSpacing: -1.5,
      color: dark ? '#fff' : DARK,
      maxWidth: 580, marginBottom: 16,
    }}>{children}</h2>
  );
}
