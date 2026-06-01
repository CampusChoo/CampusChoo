import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';

const ORANGE = '#F4521E';
const BG = '#060504';
const CARD = 'rgba(255,255,255,0.04)';
const BORDER = 'rgba(255,255,255,0.07)';
const MUTED = '#928579';

const OWNERS = [
  {
    name: 'Rolland Botchwey',
    role: 'Co-Founder',
    initials: 'RB',
  },
  {
    name: 'Sulleymana Bonny',
    role: 'Co-Founder',
    initials: 'SB',
  },
];

export default function About() {
  return (
    <div style={{ background: BG, minHeight: '100vh', color: '#ECE4DC', fontFamily: "'Inter', sans-serif" }}>
      <Navbar variant="dark" />

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '108px 5% 80px' }}>

        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <div style={{
            display: 'inline-block',
            background: `rgba(244,82,30,0.12)`, border: `1px solid rgba(244,82,30,0.25)`,
            borderRadius: 999, padding: '6px 18px',
            fontSize: 12, fontWeight: 700, color: ORANGE,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            marginBottom: 20,
          }}>
            About Us
          </div>
          <h1 style={{
            fontFamily: "'Bricolage Grotesque', sans-serif",
            fontSize: 'clamp(2rem, 5vw, 3.2rem)',
            fontWeight: 800, letterSpacing: '-1.5px',
            color: '#fff', margin: '0 0 20px',
            lineHeight: 1.1,
          }}>
            Built for campus life,<br />
            <span style={{ color: ORANGE }}>by campus people.</span>
          </h1>
          <p style={{ fontSize: 17, color: MUTED, maxWidth: 520, margin: '0 auto', lineHeight: 1.7 }}>
            CampusChoo is a student-focused food delivery platform designed to make
            campus dining fast, stress-free, and accessible — no queue, no hassle,
            just great food delivered to your door.
          </p>
        </div>

        {/* Mission */}
        <div style={{
          background: CARD, border: `1px solid ${BORDER}`,
          borderRadius: 22, padding: '36px 40px', marginBottom: 32,
          backdropFilter: 'blur(10px)',
        }}>
          <h2 style={{
            fontFamily: "'Bricolage Grotesque', sans-serif",
            fontSize: 22, fontWeight: 800, color: '#fff',
            letterSpacing: '-0.5px', marginBottom: 14,
          }}>
            Our Mission
          </h2>
          <p style={{ fontSize: 15, color: MUTED, lineHeight: 1.8, margin: 0 }}>
            We started CampusChoo because we felt the pain of long queues, missed
            meals between lectures, and limited options on campus. Our mission is
            simple — connect students with the best campus vendors and get food
            delivered anywhere on campus in under 30 minutes, every time.
          </p>
        </div>

        {/* Founders */}
        <h2 style={{
          fontFamily: "'Bricolage Grotesque', sans-serif",
          fontSize: 22, fontWeight: 800, color: '#fff',
          letterSpacing: '-0.5px', marginBottom: 20,
        }}>
          Meet the Founders
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 48 }}>
          {OWNERS.map((owner) => (
            <div key={owner.name} style={{
              background: CARD, border: `1px solid ${BORDER}`,
              borderRadius: 22, padding: '32px 28px',
              backdropFilter: 'blur(10px)',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              textAlign: 'center', gap: 16,
            }}>
              {/* Avatar */}
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: `linear-gradient(135deg, ${ORANGE}, #ff8c42)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'Bricolage Grotesque', sans-serif",
                fontSize: 26, fontWeight: 800, color: '#fff',
                boxShadow: `0 8px 24px rgba(244,82,30,0.35)`,
                flexShrink: 0,
              }}>
                {owner.initials}
              </div>

              <div>
                <div style={{
                  fontFamily: "'Bricolage Grotesque', sans-serif",
                  fontSize: 20, fontWeight: 800, color: '#fff',
                  letterSpacing: '-0.3px', marginBottom: 6,
                }}>
                  {owner.name}
                </div>
                <div style={{
                  display: 'inline-block',
                  background: 'rgba(244,82,30,0.12)', border: '1px solid rgba(244,82,30,0.25)',
                  borderRadius: 999, padding: '4px 14px',
                  fontSize: 12, fontWeight: 700, color: ORANGE,
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                }}>
                  {owner.role}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{
          background: `linear-gradient(135deg, rgba(244,82,30,0.1), rgba(244,82,30,0.04))`,
          border: `1px solid rgba(244,82,30,0.2)`,
          borderRadius: 22, padding: '36px 40px',
          textAlign: 'center',
        }}>
          <h2 style={{
            fontFamily: "'Bricolage Grotesque', sans-serif",
            fontSize: 24, fontWeight: 800, color: '#fff',
            letterSpacing: '-0.5px', marginBottom: 12,
          }}>
            Ready to order?
          </h2>
          <p style={{ fontSize: 15, color: MUTED, marginBottom: 24 }}>
            Browse our vendors and get food delivered anywhere on campus.
          </p>
          <Link to="/menu" style={{
            display: 'inline-block',
            background: ORANGE, color: '#fff',
            padding: '14px 32px', borderRadius: 999,
            fontFamily: "'Bricolage Grotesque', sans-serif",
            fontSize: 15, fontWeight: 700, textDecoration: 'none',
          }}>
            Browse Menu →
          </Link>
        </div>
      </div>
    </div>
  );
}
