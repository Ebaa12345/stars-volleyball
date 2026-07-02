import { useState } from 'react'
import { Info, Target, BookOpen, ChevronDown } from 'lucide-react'

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

  return (
    <div className="page">
      <div className="container">
        <div className="page-header">
          <span className="eyebrow">Бидний тухай</span>
          <h1>STARS Клуб</h1>
          <p>2024 оноос хойш Монголын волейболын хөгжилд хувь нэмрээ оруулж ирлээ.</p>
        </div>

        <div className="about-accordion">
          {SECTIONS.map(({ id, icon: Icon, title, body }) => {
            const isOpen = openId === id
            return (
              <div key={id} className={`about-accordion-item${isOpen ? ' open' : ''}`}>
                <button
                  className="about-accordion-header"
                  onClick={() => toggle(id)}
                  aria-expanded={isOpen}
                >
                  <span className="about-accordion-icon"><Icon size={18} /></span>
                  <span className="about-accordion-title">{title}</span>
                  <span className="about-accordion-chevron"><ChevronDown size={18} /></span>
                </button>
                <div className="about-accordion-body">
                  <div className="about-accordion-body-inner">
                    <p>{body}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Клубын түүхэн амжилтууд — идэвхжүүлэхийн тулд доорх блокийг
            тайлбараас гаргаад, бодит датагаараа солиорой. .about-highlights /
            .highlight-item классууд таны CSS-д аль хэдийн бий. */}
        {/*
        <div className="about-highlights" style={{ maxWidth: 780, margin: '32px auto 0' }}>
          {[
            { year: '2024', text: 'Клуб үүсгэн байгуулагдсан' },
            { year: '2025', text: 'Аймгийн чемпионат — 1-р байр' },
          ].map(h => (
            <div key={h.year} className="highlight-item">
              <span className="highlight-year">{h.year}</span>
              <span className="highlight-text">{h.text}</span>
            </div>
          ))}
        </div>
        */}
      </div>
    </div>
  )
}