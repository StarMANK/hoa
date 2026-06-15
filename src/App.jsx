import { useState, Fragment } from 'react';
import logoUrl from '../hoa_logo.png';

const chapters = [
  {
    id: 'origin',
    nav: '2024',
    number: '01',
    year: '2024',
    kicker: 'Origin Trail',
    title: 'BLG Dibentuk',
    body:
      'Sekelompok teman dengan passion tinggi bermain Squad dan milsim membangun gaya main sendiri. Dari sini lahir BLG, Blasteran Gorilla Babi.',
    art: 'handprint',
  },
  {
    id: 'marks',
    nav: 'BLG',
    number: '02',
    year: 'BLG',
    kicker: 'Old Symbols',
    title: 'Gorilla, Babi, Segitiga',
    body: (
      <span className="symbol-grid">
        <span className="symbol-item">
          <span className="symbol-icon">🦍</span>
          <span className="symbol-text">
            <strong>Gorilla & Babi:</strong> Kekuatan & tekad baja.
          </span>
        </span>
        <span className="symbol-item">
          <span className="symbol-icon">🔺</span>
          <span className="symbol-text">
            <strong>Segitiga:</strong> Pendiri (smbdy, Teree, BlackRaiderID).
          </span>
        </span>
        <span className="symbol-item">
          <span className="symbol-icon">🃏</span>
          <span className="symbol-text">
            <strong>Ace of Spades:</strong> Teror & intimidasi musuh.
          </span>
        </span>
      </span>
    ),
    art: 'tools',
  },
  {
    id: 'josgc',
    nav: 'JOSGC',
    number: '03',
    year: 'JOSGC',
    kicker: 'Milsim Ground',
    title: 'Kawanan Tumbuh',
    body:
      'BLG berkembang pesat di scene milsim, terutama di JOSGC. Nama lama makin dikenal, tapi ambisi kawanan mulai lebih besar.',
    art: 'trail',
  },
  {
    id: 'beyond',
    nav: 'Beyond',
    number: '04',
    year: 'FPS+',
    kicker: 'Beyond FPS',
    title: 'Lintas Genre',
    body:
      'Survival, racing, co-op, dan game lain mulai masuk. Komunitas butuh identitas yang bisa merangkul semua genre dan semua pemain.',
    art: 'bones',
  },
  {
    id: 'hoa',
    nav: 'HoA',
    number: '05',
    year: 'HoA',
    kicker: 'Hall Of Apes',
    title: 'Nama Baru, Api Sama',
    body:
      'BLG berevolusi menjadi Hall Of Apes. Logo baru dan nama baru, tapi persaudaraan, skill, dan keseruan tetap sama.',
    art: 'ape',
  },
];

const discordUrl = 'https://discord.gg/E7xcUNAGFD';

function PrimitiveArt({ type }) {
  return (
    <div className={`primitive-art primitive-art--${type}`} aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  );
}

export default function App() {
  const [cursor, setCursor] = useState({ x: 28, y: 28 });
  const [active, setActive] = useState('home');

  function handleMouseMove(event) {
    setCursor({ x: event.clientX, y: event.clientY });
  }

  return (
    <main className="origin-site" aria-label="HoA origin timeline" onMouseMove={handleMouseMove}>
      <div className="cursor-mark" data-testid="cursor-mark" style={{ '--x': `${cursor.x}px`, '--y': `${cursor.y}px` }}>
        HoA
      </div>
      <div className="background-trail" aria-hidden="true" />

      <nav className="chapter-nav" aria-label="Chapter timeline">
        <a
          className={active === 'home' ? 'is-active' : ''}
          href="#home"
          onClick={() => setActive('home')}
        >
          <span>HOME</span>
        </a>
        {chapters.map((chapter) => (
          <a
            className={active === chapter.id ? 'is-active' : ''}
            href={`#${chapter.id}`}
            key={chapter.id}
            onClick={() => setActive(chapter.id)}
          >
            <span>{chapter.nav}</span>
          </a>
        ))}
      </nav>

      <section className="hero-panel" id="home" aria-labelledby="hero-title" onMouseEnter={() => setActive('home')}>
        <div className="hero-mark">
          <div className="hero-mark-inner">
            <img className="hero-logo" src={logoUrl} alt="Hall Of Apes logo" />
          </div>
        </div>
        <div className="hero-copy">
          <p className="microcopy">Writings on the wall</p>
          <h1 id="hero-title">Hall Of Apes</h1>
          <p className="hero-path">BLG -&gt; HoA</p>
          <p className="hero-text">
            Dari BLG ke HoA, cerita evolusi kawanan dari milsim menuju komunitas
            lintas game. Scroll turun, baca ukiran, ikuti jejak simbol lama.
          </p>
          <a className="discord-cta" href={discordUrl}>Join Discord</a>
        </div>
      </section>

      <h2 className="sr-only">Origin Trail</h2>
      <section className="journey" aria-label="Vertical cave timeline">
        {/* Background sliding marquees */}
        <div className="journey-marquee marquee-1" aria-hidden="true">
          <span>BLG EVOLUTION • BLASTERAN GORILLA BABI • ORIGIN TRAIL • 2024 • JOSGC • BEYOND FPS • HALL OF APES • </span>
          <span>BLG EVOLUTION • BLASTERAN GORILLA BABI • ORIGIN TRAIL • 2024 • JOSGC • BEYOND FPS • HALL OF APES • </span>
        </div>
        <div className="journey-marquee marquee-2" aria-hidden="true">
          <span>HALL OF APES • THE FIRE STILL BURNS • MASUK KAWANAN • DISCORD • PERSAUDARAAN • SKILL • FUN • </span>
          <span>HALL OF APES • THE FIRE STILL BURNS • MASUK KAWANAN • DISCORD • PERSAUDARAAN • SKILL • FUN • </span>
        </div>

        {chapters.map((chapter) => (
          <Fragment key={chapter.id}>
            <article className="story-panel" id={chapter.id} onMouseEnter={() => setActive(chapter.id)}>
              <div className="split-year" aria-hidden="true">
                {chapter.year.split('').map((char, index) => (
                  <span key={`${chapter.id}-${char}-${index}`}>{char}</span>
                ))}
              </div>
              <div className="panel-copy">
                <p className="microcopy">{chapter.number} / {chapter.kicker}</p>
                <h2>{chapter.title}</h2>
                <p>{chapter.body}</p>
                <span className="panel-etch" aria-hidden="true">{chapter.nav}</span>
              </div>
              <PrimitiveArt type={chapter.art} />
            </article>
          </Fragment>
        ))}
      </section>

      <section className="final-panel" id="join" aria-labelledby="join-title">
        <div className="final-panel-content">
          <p className="microcopy">2026 / Fire still on</p>
          <h2 id="join-title">Masuk Kawanan</h2>
          <p>
            HoA terbuka untuk pemain yang mau main bareng, belajar bareng, dan ikut
            bikin cerita baru di luar genre lama.
          </p>
          <a href={discordUrl}>Join Kawanan</a>
        </div>
      </section>
    </main>
  );
}
