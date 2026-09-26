import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import Icon from './Icon'
import { money } from '../utils/format'
export function Notice({children,tone='info'}:{children:ReactNode;tone?:'info'|'error'|'success'}) { return <div className={'notice '+tone} role={tone==='error'?'alert':undefined}><Icon name={tone==='success'?'check':'info'} size={18}/><div>{children}</div></div> }
export function Metric({label,value,accent=false}:{label:string;value:string;accent?:boolean}) { return <div className={'metric'+(accent?' accent':'')}><span>{label}</span><strong>{value}</strong></div> }
export function Empty({title,children,icon='receipt'}:{title:string;children?:ReactNode;icon?:string}) { return <div className="empty"><span className="empty-icon"><Icon name={icon} size={28}/></span><h3>{title}</h3>{children&&<p>{children}</p>}</div> }
export function Price({value}:{value:number}) { return <span className="price">{money(value)}</span> }
export function Steps({step}:{step:number}) { return <ol className="steps" aria-label="Etapas do pedido">{['Meu pedido','Retirada','Confirmação'].map((label,i)=><li key={label} className={i+1<=step?'active':''} aria-current={i+1===step?'step':undefined}><span>{i+1<step?<Icon name="check" size={12}/>:i+1}</span>{label}</li>)}</ol> }
export function Modal({title,children,onClose}:{title:string;children:ReactNode;onClose:()=>void}) {
 const ref=useRef<HTMLDialogElement>(null)
 useEffect(()=>{ const d=ref.current!;d.showModal();return()=>d.close() },[])
 return <dialog ref={ref} className="dialog" onCancel={onClose} aria-labelledby="dialog-title"><div className="section-heading"><h2 id="dialog-title">{title}</h2><button className="icon-button" onClick={onClose} aria-label="Fechar"><Icon name="close"/></button></div>{children}</dialog>
}

