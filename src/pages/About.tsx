import { useEffect, useRef, useState } from 'react'
import { Info, Target, BookOpen, ChevronDown, CalendarDays, Users, GraduationCap, Sparkles } from 'lucide-react'

// Элемент дэлгэц рүү scroll орж ирэхэд нэг л удаа "in-view" класс нэмж,
// CSS transition-оор гулсаж/тодрох animation өдөөнө.
function useRevealOnScroll(count: number) {
  const refs = useRef<(HTMLDivElement | null)[]>([])
  const [visible, setVisible] = useState<boolean[]>(() => Array(count).fill(false))

  useEffect(() => {
    const nodes = refs.current
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return
          const idx = nodes.indexOf(entry.target as HTMLDivElement)
          if (idx === -1) return
          setVisible(prev => (prev[idx] ? prev : prev.map((v, i) => (i === idx ? true : v))))
          observer.unobserve(entry.target)
        })
      },
      { threshold: 0.15, rootMargin: '0px 0px -60px 0px' }
    )

    nodes.forEach(el => el && observer.observe(el))
    return () => observer.disconnect()
  }, [count])

  return { refs, visible }
}

// Гарчгийн доорх товч тоон мэдээлэл — клубыг нэг харцаар танилцуулна
const HIGHLIGHTS = [
  { icon: CalendarDays, value: '2024', label: 'Байгуулагдсан' },
  { icon: Users, value: '100+', label: 'Гишүүд' },
  { icon: GraduationCap, value: '3', label: 'Дасгалжуулагч' },
  { icon: Sparkles, value: '8–17', label: 'Насны ангилал' },
]

// Хэсэг бүрийг эндээс засна — гарчиг дээр дарахад доод текст нь
// нээгдэж/хаагдана (accordion).
const SECTIONS = [
  {
    id: 'about',
    icon: Info,
    title: 'Бидний тухай',
    body: (
      <>
        STARS Volleyball Club нь 2024 онд байгуулагдсан бөгөөд волейболын спортыг хөгжүүлэх,
        хүүхэд, залуучууд болон насанд хүрэгчдэд чанартай сургалт явуулах зорилготойгоор
        үйл ажиллагаагаа явуулж байна.
        <br /><br />
        Клубын ерөнхий дасгалжуулагчаар "SG Hawks" клубын туслах дасгалжуулагч, спортын мастер
        Б.Батсүрэн ажилладаг. Олон жилийн туршлага, орчин үеийн сургалтын арга зүйд тулгуурлан
        тамирчдын техник, тактик, бие бялдар, сэтгэлзүйн бэлтгэлийг цогцоор нь хөгжүүлэхэд
        анхааран ажиллаж байна.
      </>
    ),
  },
  {
    id: 'vision',
    icon: Target,
    title: 'Манай клубын Алсын хараа',
    body: (
      <>
        Монголын волейболын хөгжилд бодит хувь нэмэр оруулж, олон улсын түвшинд өрсөлдөх
        чадвартай тамирчдыг бэлтгэдэг, итгэл хүлээсэн шилдэг волейболын клуб болохыг зорин
        ажиллаж байна.
      </>
    ),
  },
  {
    id: 'program',
    icon: BookOpen,
    title: 'Манай хөтөлбөр',
    body: (
      <>
        Манай клуб 8–17 насны хүүхэд, өсвөр үеийнхэн болон насанд хүрэгчдийн сургалтыг
        тогтмол зохион байгуулдаг. Суралцагч бүрийн ур чадвар, нас, хөгжлийн онцлогт тохирсон
        сургалтын хөтөлбөрөөр дамжуулан зөв техник, сахилга бат, багаар ажиллах чадвар,
        спортын ёс зүйг төлөвшүүлэхийг эрхэм зорилгоо болгодог.
      </>
    ),
  },
]

export default function About() {
  // Эхлээд эхний хэсэг нээлттэй харагдана
  const [openId, setOpenId] = useState<string | null>('about')

  function toggle(id: string) {
    setOpenId(prev => (prev === id ? null : id))
  }

  const highlightReveal = useRevealOnScroll(HIGHLIGHTS.length)
  const timelineReveal = useRevealOnScroll(SECTIONS.length)

  return (
    <div className="page about-page">
      <div className="about-glow" aria-hidden="true" />
      <div className="container">
        <div className="page-header">
          <span className="eyebrow">Бидний тухай</span>
          <h1>STARS Клуб</h1>
          <p>2024 оноос хойш Монголын волейболын хөгжилд хувь нэмрээ оруулж ирлээ.</p>
        </div>

        <div className="about-highlights">
          {HIGHLIGHTS.map(({ icon: Icon, value, label }, i) => (
            <div
              key={label}
              ref={el => { highlightReveal.refs.current[i] = el }}
              className={`about-highlight-card${highlightReveal.visible[i] ? ' in-view' : ''}`}
              style={{ transitionDelay: `${i * 70}ms` }}
            >
              <Icon size={20} />
              <div>
                <strong>{value}</strong>
                <span>{label}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="about-timeline">
          {SECTIONS.map(({ id, icon: Icon, title, body }, i) => {
            const isOpen = openId === id
            const isVisible = timelineReveal.visible[i]
            return (
              <div
                key={id}
                ref={el => { timelineReveal.refs.current[i] = el }}
                className={`about-timeline-item${isOpen ? ' open' : ''}${isVisible ? ' in-view' : ''}`}
                style={{ transitionDelay: `${i * 110}ms` }}
              >
                <div className="about-timeline-marker">
                  <span className="about-timeline-icon">
                    <Icon size={18} />
                    <span className="about-timeline-index">{String(i + 1).padStart(2, '0')}</span>
                  </span>
                </div>
                <div className="about-timeline-card">
                  <button
                    className="about-timeline-header"
                    onClick={() => toggle(id)}
                    aria-expanded={isOpen}
                  >
                    <span className="about-timeline-title">{title}</span>
                    <span className="about-timeline-chevron"><ChevronDown size={18} /></span>
                  </button>
                  <div className="about-timeline-body">
                    <div className="about-timeline-body-inner">
                      <p>{body}</p>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}