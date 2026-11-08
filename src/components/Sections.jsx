import { useCountUp } from '../hooks/useMotion.js';
import { genres, rules, stats, symbols } from '../data/content.js';
import { ArrowGlyph, DiscordGlyph, Glyph, PrimitiveArt } from './Marks.jsx';
import { Procession } from './Apes.jsx';
import { HollowWords, KineticTitle } from './World.jsx';

export function Rail({ items, active, onNavigate }) {
  return (
    <nav className="rail" aria-label="Chapter timeline">
      {items.map((item) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          className={active === item.id ? 'is-active' : ''}
          aria-current={active === item.id ? 'true' : undefined}
          onClick={(event) => onNavigate(event, item.id)}
        >
          <span>{item.nav}</span>
          <span aria-hidden="true" />
        </a>
      ))}
    </nav>
  );
}

export function Hero({ discord, hero, brand, logoUrl }) {
  return (
    <section className="hero" id="home" aria-labelledby="hero-title">
      <div className="hero__plate" aria-hidden="true">
        <img className="hero__logo" src={logoUrl} alt="Hall Of Apes logo" />
      </div>

      <div className="hero__stack">
        <p className="micro hero__kicker">
          <span className="dot" aria-hidden="true" />
          {brand.tagline}
        </p>

        <KineticTitle id="hero-title" lines={hero.titleLines} />

        <p className="hero__path">
          {brand.predecessor} <b aria-hidden="true">&rarr;</b> {brand.short}
          <span className="sr-only"> ({brand.predecessorLong} menjadi Hall Of Apes)</span>
        </p>

        <div className="hero__foot">
          <p className="lead">{hero.lead}</p>
          <div className="hero__actions">
            <a className="cta" href={discord}>
              <DiscordGlyph />
              {hero.primaryCta}
            </a>
            <a className="cta cta--ghost" href="#origin">
              {hero.secondaryCta}
              <ArrowGlyph />
            </a>
          </div>
          <p className="body-copy hero__blurb">{hero.blurb}</p>
          <p className="scroll-hint">
            Scroll
            <ArrowGlyph />
          </p>
        </div>
      </div>

      {/* The subject, not decoration: the kawanan walking across the fold. */}
      <Procession />
    </section>
  );
}

export function Trail({ sections }) {
  return (
    <section className="trail" id="trail" aria-label="Origin trail timeline">
      <div className="trail__thread" aria-hidden="true" />
      <div className="shell trail__inner">
        {sections.map((chapter, index) => (
          <Chapter key={chapter.id} chapter={chapter} flipped={index % 2 === 1} />
        ))}
      </div>
    </section>
  );
}

function Chapter({ chapter, flipped }) {
  return (
    <article
      className={`chapter${flipped ? ' chapter--flip' : ''}`}
      id={chapter.id}
      aria-labelledby={`${chapter.id}-title`}
    >
      <div className="display chapter__year" aria-hidden="true">
        {chapter.year}
      </div>

      <div className="chapter__copy">
        <p className="chapter__index">
          {chapter.number} / {chapter.kicker}
        </p>
        <h2 className="display chapter__title" id={`${chapter.id}-title`}>
          {chapter.title}
        </h2>
        <p className="chapter__body">{chapter.body}</p>
        <ul className="marks">
          {chapter.marks.map((mark) => (
            <li key={mark}>{mark}</li>
          ))}
        </ul>
        {chapter.art === 'glyphs' ? <SymbolGrid /> : null}
      </div>

      <div className="chapter__mark">
        <PrimitiveArt type={chapter.art} />
      </div>
    </article>
  );
}

function SymbolGrid() {
  return (
    <div className="chapter__glyphs">
      {symbols.map((symbol) => (
        <div className="glyph-tile" key={symbol.id}>
          <Glyph name={symbol.icon} />
          <h3 className="glyph-tile__name">{symbol.name}</h3>
          <p>{symbol.text}</p>
        </div>
      ))}
    </div>
  );
}

export function DataBand() {
  return (
    <section className="data" aria-label="Facts about the kawanan">
      <div className="shell data__grid">
        {stats.map((stat) => (
          <Stat key={stat.label} {...stat} />
        ))}
      </div>
    </section>
  );
}

function Stat({ value, label, suffix, note }) {
  const { ref, value: shown } = useCountUp(value);
  return (
    <div className="stat reveal" ref={ref}>
      <span className="display stat__value">
        {Math.round(shown)}
        {suffix}
      </span>
      <span className="stat__label">{label}</span>
      <span className="stat__note">{note}</span>
    </div>
  );
}

export function Genres() {
  return (
    <section className="section" id="genres" aria-labelledby="genres-title">
      <div className="shell">
        <div className="section-head">
          <div>
            <p className="micro band-label reveal">Beyond one genre</p>
            <h2 className="display h2 reveal" data-delay="1" id="genres-title">
              Satu Kawanan, Banyak Medan
            </h2>
          </div>
          <p className="reveal" data-delay="2">
            Kawanan ini mulai di medan milsim, tapi nggak berhenti di situ. Ini
            medan yang sudah dan masih kami sewa bareng.
          </p>
        </div>

        <ul className="genres">
          {genres.map((genre) => (
            <li className="genre" key={genre.name} style={{ '--intensity': genre.intensity / 100 }}>
              <span className="genre__name">{genre.name}</span>
              <span className="genre__note">{genre.note}</span>
              <span className="genre__bar" aria-hidden="true">
                <i />
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function Rules() {
  return (
    <section className="section section--dark" id="rules" aria-labelledby="rules-title">
      <div className="shell">
        <div className="section-head">
          <div>
            <p className="micro band-label reveal">Kode kawanan</p>
            <h2 className="display h2 reveal" data-delay="1" id="rules-title">
              Empat Aturan Dinding
            </h2>
          </div>
          <p className="reveal" data-delay="2">
            Bukan tata tertib panjang. Empat hal ini yang bikin kawanan tetap
            jalan setelah nama dan genre berganti.
          </p>
        </div>

        <div className="rules">
          {rules.map((rule, index) => (
            <article className="rule reveal" data-delay={index + 1} key={rule.id}>
              <span className="rule__num">0{index + 1}</span>
              <h3>{rule.title}</h3>
              <p>{rule.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Join({ join, discord }) {
  return (
    <section className="join" id="join" aria-labelledby="join-title">
      <div className="join__bg" aria-hidden="true" />
      <div className="shell join__grid">
        <div>
          <p className="micro band-label reveal">{join.kicker}</p>
          <h2 className="display join__title reveal" data-delay="1" id="join-title">
            <HollowWords text={join.title} hollowWords={['Kawanan']} />
          </h2>
        </div>

        <div className="join__card reveal" data-delay="2">
          <p className="body-copy" style={{ color: 'rgba(243,240,231,.86)' }}>
            {join.body}
          </p>
          <div>
            <a className="cta cta--onDark" href={discord}>
              <DiscordGlyph />
              {join.cta}
            </a>
          </div>
          <div className="join__meta">
            <span>Discord / markas utama</span>
            <span>BF2024 / lintas genre</span>
            <span>Wajib hadir, boleh ngakak</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Footer({ footer }) {
  return (
    <footer className="foot">
      <div className="shell foot__grid">
        <div className="foot__notes">
          {footer.notes.map((note) => (
            <span key={note}>{note}</span>
          ))}
        </div>
        <p className="foot__legal">{footer.legal}</p>
      </div>
    </footer>
  );
}
