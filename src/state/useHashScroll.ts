import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/** 사이드바 소메뉴(#구역 id)로 들어오면 그 구역으로 스크롤한다. ready: 구역이 그려진 뒤에 true */
export function useHashScroll(ready = true) {
  const { hash } = useLocation()
  useEffect(() => {
    if (!hash || !ready) return
    const t = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' }), 50)
    return () => clearTimeout(t)
  }, [hash, ready])
}
