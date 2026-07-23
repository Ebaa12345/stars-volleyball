import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// key={pathname} ашигласнаар шинэ хуудас руу шилжих бүрд wrapper div шинээр
// mount хийгдэж, CSS @keyframes animation (доор index.css-д) автоматаар
// эхнээс нь тоглоно — JS талд state машин (opacity toggling) хэрэггүй тул
// хуудасны дотоод interactivity (accordion, form гэх мэт) хэзээ ч
// "царцахгүй" (children шууд, өөрчлөгдөөгүй дамждаг).
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation()

  // Шинэ хуудас руу шилжихэд өмнөх хуудасны scroll байрлал үлдэж, дунд
  // хэсгээс нь эхэлдэг байсныг засаж, үргэлж дээрээс эхэлдэг болгоно.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  return (
    <div key={location.pathname} className="page-transition">
      {children}
    </div>
  )
}
