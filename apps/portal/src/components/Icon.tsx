import type { CSSProperties } from 'react'
const paths:Record<string,string> = {
  arrow:'M19 12H5m6-6-6 6 6 6', chevron:'m9 5 7 7-7 7', search:'m21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  bag:'M5 7h14l1 14H4L5 7Zm3 0V5a4 4 0 0 1 8 0v2',
  user:'M20 21v-2a7 7 0 0 0-14 0v2M17 6a5 5 0 1 1-10 0 5 5 0 0 1 10 0',
  users:'M16 21v-2a6 6 0 0 0-12 0v2m18 0v-2a6 6 0 0 0-4-5M15 3a4 4 0 0 1 0 8M14 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  wallet:'M20 8V5H5a3 3 0 0 0 0 6h16v10H5a3 3 0 0 1-3-3V8m19 6h-6v4h6m-3-2h.01',
  calendar:'M4 5h16v16H4V5Zm4-3v6m8-6v6M4 10h16m-12 4h2m4 0h2m-8 4h2',
  clock:'M12 7v5l3 2m7-2a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  check:'m5 12 4 4L19 6', plus:'M12 5v14M5 12h14', minus:'M5 12h14',
  trash:'M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7',
  info:'M12 11v6m0-10h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  logout:'M9 4H4v16h5m5-4 4-4-4-4m-6 4h12',
  receipt:'M5 3h14v19l-3-2-4 2-4-2-3 2V3Zm4 5h6m-6 4h6m-6 4h4',
  home:'m3 10 9-7 9 7M5 9v12h14V9m-10 12v-7h6v7',
  snack:'M7 15 4 18m2 2-2-2-2-2m5-1C1 8 10 2 14 6c2-2 7-1 7 3 0 5-6 9-10 8l-4-2Z',
  bread:'M4 17c-4-5 2-13 8-13s12 8 8 13c-4 4-12 4-16 0Zm3-9 2 2m5-4 1 3m2 3 2 1m-9 1 1 2',
  cup:'M5 7h14l-2 14H7L5 7Zm-1 0h16M12 7l2-5h4',
  bottle:'M10 2h4v5l3 4v11H7V11l3-4V2Zm0 3h4M7 13h10m-10 5h10',
  sandwich:'M3 11 12 3l9 8H3Zm0 3h18v7H3v-7Zm0 3 4 2 5-2 5 2 4-2',
  cake:'M3 10h18v11H3V10Zm0 5 4 2 5-2 5 2 4-2M7 10V6m5 4V6m5 4V6m-10-3h.01m5 0h.01m5 0h.01',
  eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  shield:'m12 2 8 3v6c0 6-8 11-8 11S4 17 4 11V5l8-3Zm-4 10 3 3 5-6',
  close:'m6 6 12 12M6 18 18 6'
}
export default function Icon({name,size=20,style}:{name:string;size?:number;style?:CSSProperties}) {
 return <svg width={size} height={size} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]||paths.info}/></svg>
}

