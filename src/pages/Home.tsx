import { Link } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { useAuth } from '../hooks/useAuth'
import { Trophy, Users, Calendar, ChevronRight, GraduationCap, Stars, Medal } from 'lucide-react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

// 1. Mikasa Шар+Цэнхэр өнгөтэй 3D Бөмбөг (Хэмжээг чүүд чүүд жижигсгэсэн)
function VolleyballBall({ spinBoostRef }: { spinBoostRef?: React.MutableRefObject<number> }) {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame(() => {
    if (meshRef.current) {
      const boost = spinBoostRef?.current ?? 0
      meshRef.current.rotation.y += 0.003 + boost // Ард аажуухан гоё эргэнэ, scroll хийхэд түргэсэж "гүйнэ"
      meshRef.current.rotation.x += 0.001 + boost * 0.4
    }
    if (spinBoostRef) spinBoostRef.current *= 0.9 // Түлхэлт аажим намдана
  })

  return (
    <mesh ref={meshRef}>
      {/* args={[1.4, ...]} болгож хэмжээг нь бага зэрэг жижигсгэв */}
      <sphereGeometry args={[1.4, 64, 64]} />
      <shaderMaterial
        vertexShader={`
          varying vec2 vUv;
          varying vec3 vNormal;
          void main() {
            vUv = uv;
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          varying vec2 vUv;
          varying vec3 vNormal;
          void main() {
            float pattern = sin(vUv.x * 12.5 + sin(vUv.y * 6.0) * 2.0) * cos(vUv.y * 12.5);
            vec3 yellow = vec3(0.98, 0.80, 0.00);
            vec3 blue = vec3(0.02, 0.23, 0.65);
            float edge = smoothstep(-0.1, 0.1, pattern);
            vec3 finalColor = mix(yellow, blue, edge);

            vec3 lightDir = normalize(vec3(5.0, 5.0, 4.0));
            float intensity = max(dot(vNormal, lightDir), 0.3);

            gl_FragColor = vec4(finalColor * intensity, 1.0);
          }
        `}
      />
    </mesh>
  )
}

// 3D Scene - Одоо өргөн нь бүтэн дэлгэцээр арын фон болж ажиллана
function VolleyballScene({ spinBoostRef }: { spinBoostRef?: React.MutableRefObject<number> }) {
  return (
    <div style={{ width: '100%', height: '100%', cursor: 'grab' }}>
      <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
        <ambientLight intensity={0.8} />
        <directionalLight position={[5, 5, 4]} intensity={1.5} />
        <VolleyballBall spinBoostRef={spinBoostRef} />
        <OrbitControls enableZoom={false} />
      </Canvas>
    </div>
  )
}

// Hero-гийн ард байрлах том бөмбөг бичгийг далдлахгүйн тулд хөдөлгөөнгүй
// хэвээр үлдэнэ. Харин hero бүрэн scroll-оор өнгөрсний дараа (текст дэлгэц
// дээрээс гарсны дараа) баруун захад бяцхан бөмбөг гарч ирээд доошоо
// "гүйж" хуудасны төгсгөлд хамтрагч болон зогсоно. PageTransition wrapper
// CSS transform ашигладаг тул position:fixed элемент viewport бус тэр
// wrapper-т наалддаг — иймд body руу шууд portal хийнэ.
function RunningVolleyball({ heroRef }: { heroRef: React.RefObject<HTMLElement> }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const spinBoostRef = useRef(0)
  const heroHeightRef = useRef(1)
  const lastYRef = useRef(0)

  useEffect(() => {
    lastYRef.current = window.scrollY

    const measure = () => {
      const hero = heroRef.current
      if (hero) heroHeightRef.current = hero.offsetHeight
    }

    let ticking = false
    const update = () => {
      ticking = false
      const el = wrapRef.current
      if (!el) return

      const scrollY = window.scrollY
      const delta = scrollY - lastYRef.current
      lastYRef.current = scrollY
      spinBoostRef.current += Math.abs(delta) * 0.0006

      // Hero-г бүрэн өнгөрсний дараа (текст дэлгэцнээс гарсны дараа) л
      // тоглогдоно — тиймээс огт бичиг рүү давхцахгүй.
      const travelStart = heroHeightRef.current
      const travelSpan = 520
      const t = Math.min(Math.max((scrollY - travelStart) / travelSpan, 0), 1)
      const appearing = scrollY > travelStart

      const startSize = 170
      const endSize = 110
      const size = startSize + (endSize - startSize) * t

      const centerX = window.innerWidth - 90
      const startCenterY = 110
      const endCenterY = window.innerHeight - 100
      const centerY = startCenterY + (endCenterY - startCenterY) * t

      el.style.width = `${size}px`
      el.style.height = `${size}px`
      el.style.transform = `translate3d(${centerX - size / 2}px, ${centerY - size / 2}px, 0)`
      el.style.opacity = appearing ? '1' : '0'
    }

    const onScroll = () => {
      if (!ticking) {
        ticking = true
        requestAnimationFrame(update)
      }
    }
    const onResize = () => {
      measure()
      update()
    }

    measure()
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
    }
  }, [heroRef])

  return createPortal(
    <div ref={wrapRef} className="running-ball-wrap">
      <VolleyballScene spinBoostRef={spinBoostRef} />
    </div>,
    document.body
  )
}

// Hex өнгийг "r, g, b" мөр болгож хөрвүүлнэ — CSS дотор rgba(var(--accent-rgb), alpha) хэлбэрээр ашиглана
function hexToRgbTriplet(hex: string) {
  const clean = hex.replace('#', '')
  const bigint = parseInt(clean, 16)
  return `${(bigint >> 16) & 255}, ${(bigint >> 8) & 255}, ${bigint & 255}`
}

export default function Home() {
  const { user, isAdmin } = useAuth()
  const heroRef = useRef<HTMLElement>(null)

  // Stat картан бүрд өөрийн өнгө (glassmorphism icon glow-д ашиглана)
  const stats = [
    { label: 'Гишүүд', value: '100+', icon: Users, color: '#3b82f6' },
    { label: 'Улирлын бэлтгэл', value: '18', icon: Medal, color: '#f97316' },
    { label: 'Дасгалжуулагчид', value: '3', icon: GraduationCap, color: '#a855f7' },
    { label: 'Дасгалжуулалт / долоо хоног', value: '4', icon: Calendar, color: '#10b981' },
  ]

  return (
    <div className="page-home">
      <RunningVolleyball heroRef={heroRef} />

      {/* Hero Section */}
      <section className="hero" ref={heroRef}>
        {/* 1. Арын дэвсгэр өнгө ба тор */}
        <div className="hero-bg">
          <div className="hero-net" />
        </div>

        {/* 2. ЯГ БИЧГИЙН АРД БАЙРЛАХ 3D БӨМБӨГ (хөдөлгөөнгүй — бичгийг далдлахгүй) */}
        <div className="hero-3d-bg">
          <VolleyballScene />
        </div>

        {/* 3. ДЭЭР НЬ ГОЛЛОЖ ХАРАГДАХ ТЕКСТҮҮД */}
        <div className="hero-content">
          <div className="hero-eyebrow">
            <Stars size={16} /> Mongolia Volleyball Club
          </div>
          <h1 className="hero-title">
            STARS<br />
            <span className="accent">VOLLEYBALL</span>
          </h1>
          <p className="hero-sub">
            Монголын шилдэг волейбол клуб. Хүч, хурд, нэгдмэл байдал —
            бид нэг хэмнэлд тоглодог.
          </p>
          <div className="hero-cta">
            {user ? (
              <Link to={isAdmin ? '/admin' : '/schedule'} className="btn-primary">
                Хуваарь харах <ChevronRight size={18} />
              </Link>
            ) : (
              <>
                <Link to="/about" className="btn-secondary">Бидний тухай</Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Stats Section — Glassmorphism cards, өнгөт icon glow */}
      <section className="stats-section">
        <div className="container">
          <div className="stats-grid">
            {stats.map(({ label, value, icon: Icon, color }) => (
              <div
                key={label}
                className="stat-card"
                style={{ ['--accent' as any]: color, ['--accent-rgb' as any]: hexToRgbTriplet(color) }}
              >
                <div className="stat-icon">
                  <Icon size={26} />
                </div>
                <div className="stat-info">
                  <h3>{value}</h3>
                  <p>{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="section features">
        <div className="container">
          <h2 className="section-title">Яагаад бидэнтэй нэгдэх вэ?</h2>
          <div className="feature-grid">
            {[
              {
                title: 'Мэргэжлийн дасгалжуулалт',
                desc: 'Туршлагатай дасгалжуулагч нарын удирдлага дор өдөр бүр дасгал хийнэ.',
                emoji: '🏆'
              },
              {
                title: '7 хоногийн хуваарь',
                desc: 'Таны хувийн хуваарийг admin тохируулж, та хэзээ ч харж болно.',
                emoji: '📅'
              },
              {
                title: 'Баг нэгдмэл байдал',
                desc: 'Хамт олны уур амьсгал, найрсаг орчинд хөгжих боломж.',
                emoji: '🤝'
              },
            ].map(f => (
              <div key={f.title} className="feature-card">
                <div className="feature-emoji">{f.emoji}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Home → About гүүр хэсэг — Hero-гийн 3D бөмбөгний шар/цэнхэр (Mikasa)
          өнгөний схемийг conic-gradient "orb" glow-оор цуурайтуулж, About руу
          татдаг. Дахин WebGL canvas ачаалахгүй тул хөнгөн. */}
      <section className="home-about-bridge">
        <div className="container">
          <div className="bridge-card">
            <div className="bridge-orb" aria-hidden="true" />
            <div className="bridge-content">
              <span className="eyebrow">Бидний түүх</span>
              <h2>2024 оноос хойш нэг зорилгын төлөө</h2>
              <p>
                Клубын үүсэл, алсын хараа, сургалтын хөтөлбөрийн талаар — бидэн
                ямар зам туулж, юуг зорьж яваагаа дэлгэрэнгүй үзээрэй.
              </p>
              <Link to="/about" className="btn-primary">
                Бидний тухай унших <ChevronRight size={18} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Band */}
      {/*{!user && (
        <section className="cta-band">
          <div className="container">
            <h2>Клубт нэгдэхэд бэлэн үү?</h2>
            <p>Бүртгүүлж, хуваарьтай, хамт тоглоцгооё.</p>
            <Link to="/signup" className="btn-primary">
              Одоо бүртгүүлэх
            </Link>
          </div>
        </section>
      )}*/}





    </div>
  )
}